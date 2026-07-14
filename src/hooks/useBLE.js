import { useState, useCallback, useRef } from 'react';

const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const LED_WRITE_UUID = 'deadbeef-1234-1234-1234-123456789abc';
const BUZZER_WRITE_UUID = 'deadbeef-1234-1234-1234-123456789abd';
const RSSI_READ_UUID = 'abcd1234-5678-1234-5678-abcdef123457';
const NAME_WRITE_UUID = 'deadbeef-1234-1234-1234-123456789abe';

const MAX_NAME_LENGTH = 20;

// ============================================================================
// Convert RSSI to proximity percentage (0-100%)
// ============================================================================
function rssiToProximity(rssi) {
  if (rssi === null || rssi === undefined) return 0;

  // RSSI range: -100 dBm (far) to -30 dBm (very close)
  const minRSSI = -100;
  const maxRSSI = -30;

  const clamped = Math.max(minRSSI, Math.min(maxRSSI, rssi));
  const proximity = ((clamped - minRSSI) / (maxRSSI - minRSSI)) * 100;

  return Math.round(Math.max(0, Math.min(100, proximity)));
}

// ============================================================================
// Convert proximity percentage to output value (0-255)
// When close (100%) → full output (255)
// When far (0%) → minimum output (30)
// ============================================================================
function proximityToOutputValue(proximityPercent) {
  const minOutput = 30;   // Minimum brightness/volume
  const maxOutput = 255;  // Maximum brightness/volume

  return Math.round(
    minOutput + (proximityPercent / 100) * (maxOutput - minOutput)
  );
}

// ============================================================================
// Main Hook
// ============================================================================
export default function useBLE() {
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [discoveryInProgress, setDiscoveryInProgress] = useState(false);
  const [rssi, setRssi] = useState(null);
  const [proximityPercent, setProximityPercent] = useState(0);

  const deviceRef = useRef(null);
  const ledCharacteristicRef = useRef(null);
  const buzzerCharacteristicRef = useRef(null);
  const rssiCharacteristicRef = useRef(null);
  const nameCharacteristicRef = useRef(null);
  const pollingActiveRef = useRef(false);

  // ========================================================================
  // Continuous RSSI Polling (Every 1 second)
  // Self-rescheduling: each poll only schedules the next one after it
  // resolves, so a slow BLE read can never overlap with the next poll.
  // ========================================================================
  const startContinuousPolling = useCallback(() => {
    // Guard against multiple overlapping polling loops.
    if (pollingActiveRef.current) {
      console.log('Polling already active, skipping duplicate start');
      return;
    }

    pollingActiveRef.current = true;

    const pollRssi = async () => {
      if (!pollingActiveRef.current || !rssiCharacteristicRef.current) return;

      try {
        const value = await rssiCharacteristicRef.current.readValue();

        // Read as 2-byte signed integer (little-endian)
        const view = new DataView(value.buffer);
        const newRssi = view.getInt16(0, true);

        setRssi(newRssi);
        const proximity = rssiToProximity(newRssi);
        setProximityPercent(proximity);

        console.log('RSSI auto-polled:', newRssi, '| Proximity:', proximity + '%');
      } catch (error) {
        console.error('Auto-poll RSSI error:', error);
      }

      // Only schedule the next poll after this one has fully resolved
      // (success or failure), and only if we're still connected.
      if (pollingActiveRef.current) {
        setTimeout(pollRssi, 1000);
      }
    };

    // Poll immediately, then self-reschedule every 1 second
    pollRssi();
  }, []);

  // ========================================================================
  // Shared connection setup, used by both connect() (new device, shows the
  // OS picker via requestDevice) and connectToKnown() (known device, from
  // navigator.bluetooth.getDevices(), no picker shown). Both paths need the
  // exact same GATT/characteristic/listener/polling setup — this is that
  // setup, kept in one place so there's only one version to maintain.
  // Throws on failure; callers decide how to surface that (alert vs. inline
  // error state).
  // ========================================================================
  const establishConnection = useCallback(async (device) => {
    // Defensive: if a previous connection is still live (e.g. connect() got
    // triggered twice without an explicit disconnect in between), tear it
    // down first so we never end up with two overlapping polling loops or
    // two sets of characteristic references.
    if (deviceRef.current) {
      pollingActiveRef.current = false;
      try {
        deviceRef.current.gatt.disconnect();
      } catch (error) {
        console.error('Cleanup of previous connection failed:', error);
      }
      deviceRef.current = null;
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);

    // Get LED characteristic
    const ledCharacteristic = await service.getCharacteristic(LED_WRITE_UUID);
    ledCharacteristicRef.current = ledCharacteristic;

    // Get Buzzer characteristic
    const buzzerCharacteristic = await service.getCharacteristic(BUZZER_WRITE_UUID);
    buzzerCharacteristicRef.current = buzzerCharacteristic;

    // Get RSSI characteristic
    const rssiCharacteristic = await service.getCharacteristic(RSSI_READ_UUID);
    rssiCharacteristicRef.current = rssiCharacteristic;

    // Get Name characteristic (firmware-side device naming)
    const nameCharacteristic = await service.getCharacteristic(NAME_WRITE_UUID);
    nameCharacteristicRef.current = nameCharacteristic;

    deviceRef.current = device;

    // Listen for unexpected disconnects (e.g. walking out of range, the
    // phone's Bluetooth stack silently dropping and re-bonding) — not just
    // ones triggered by our own disconnect() button.
    device.addEventListener('gattserverdisconnected', () => {
      console.log('Unexpected GATT disconnect detected');
      pollingActiveRef.current = false;
      deviceRef.current = null;
      ledCharacteristicRef.current = null;
      buzzerCharacteristicRef.current = null;
      rssiCharacteristicRef.current = null;
      nameCharacteristicRef.current = null;
      setConnectedDevice(null);
      setRssi(null);
      setProximityPercent(0);
    }, { once: true });

    setConnectedDevice({
      id: device.id,
      name: device.name || 'Unknown Device',
      device
    });

    // Start continuous RSSI polling (every 1 second)
    startContinuousPolling();

    console.log('Connected to:', device.name);
    console.log('RSSI characteristic UUID:', RSSI_READ_UUID);
  }, [startContinuousPolling]);

  // ========================================================================
  // Connect to Device (new device, via OS picker)
  // Takes the BluetoothDevice object directly (found by startDiscovery via
  // requestDevice).
  // ========================================================================
  const connect = useCallback(async (device) => {
    if (!navigator.bluetooth) {
      alert('Web Bluetooth API not available');
      return;
    }

    try {
      await establishConnection(device);
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect: ' + error.message);
    }
  }, [establishConnection]);

  // ========================================================================
  // Connect to a Known Device (silent reconnect, no OS picker)
  // Takes a BluetoothDevice object from navigator.bluetooth.getDevices().
  // Returns { success, error } instead of alerting, so the caller (the
  // known-devices list UI) can show an inline "couldn't find it nearby"
  // message rather than a browser alert popup.
  // ========================================================================
  const connectToKnown = useCallback(async (device) => {
    if (!navigator.bluetooth) {
      return { success: false, error: 'Web Bluetooth API not available' };
    }

    try {
      await establishConnection(device);
      return { success: true };
    } catch (error) {
      console.error('Silent reconnect failed:', error);
      return { success: false, error: error.message };
    }
  }, [establishConnection]);

  // ========================================================================
  // Disconnect from Device
  // ========================================================================
  const disconnect = useCallback(async () => {
    // Stop polling — the loop checks this flag before scheduling its next
    // iteration, so no more polls will fire after this.
    pollingActiveRef.current = false;

    if (deviceRef.current) {
      try {
        deviceRef.current.gatt.disconnect();
        console.log('Disconnected');
      } catch (error) {
        console.error('Disconnect error:', error);
      }
      deviceRef.current = null;
      ledCharacteristicRef.current = null;
      buzzerCharacteristicRef.current = null;
      rssiCharacteristicRef.current = null;
      nameCharacteristicRef.current = null;
      setConnectedDevice(null);
      setRssi(null);
      setProximityPercent(0);
    }
  }, []);

  // ========================================================================
  // Start Device Discovery (new device, via OS picker)
  // ========================================================================
  const startDiscovery = useCallback(async () => {
    if (!navigator.bluetooth) {
      alert('Web Bluetooth API not available');
      return;
    }

    setDiscoveryInProgress(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        optionalServices: [SERVICE_UUID],
        filters: [{ services: [SERVICE_UUID] }]
      });

      if (device) {
        await connect(device);
      }
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        console.error('Discovery error:', error);
      }
    } finally {
      setDiscoveryInProgress(false);
    }
  }, [connect]);

  // ========================================================================
  // Send LED Brightness
  // ========================================================================
  const sendLedBrightness = useCallback(async (brightness) => {
    if (!ledCharacteristicRef.current) {
      console.error('LED characteristic not connected');
      return;
    }

    try {
      const value = Math.min(Math.max(brightness, 0), 255);
      const data = new Uint8Array([value]);

      await ledCharacteristicRef.current.writeValue(data);
      console.log('LED brightness sent:', value);
    } catch (error) {
      console.error('Send LED error:', error);
    }
  }, []);

  // ========================================================================
  // Send Buzzer Volume
  // ========================================================================
  const sendBuzzerVolume = useCallback(async (volume) => {
    if (!buzzerCharacteristicRef.current) {
      console.error('Buzzer characteristic not connected');
      return;
    }

    try {
      const value = Math.min(Math.max(volume, 0), 255);
      const data = new Uint8Array([value]);

      await buzzerCharacteristicRef.current.writeValue(data);
      console.log('Buzzer volume sent:', value);
    } catch (error) {
      console.error('Send buzzer error:', error);
    }
  }, []);

  // ========================================================================
  // Send Device Name (firmware-side naming)
  // Writes the name to the ESP32, which persists it to NVS and renames
  // itself immediately. Truncates to MAX_NAME_LENGTH to match firmware's
  // own cap. Unlike sendLedBrightness/sendBuzzerVolume, this THROWS on
  // failure instead of swallowing the error — the caller (Settings/App.jsx)
  // needs to know if a rename didn't actually reach the device, so it can
  // avoid saving a name locally that the firmware never received.
  // ========================================================================
  const sendDeviceName = useCallback(async (name) => {
    if (!nameCharacteristicRef.current) {
      throw new Error('Name characteristic not connected');
    }

    const truncated = name.length > MAX_NAME_LENGTH
      ? name.substring(0, MAX_NAME_LENGTH)
      : name;

    const encoder = new TextEncoder();
    const data = encoder.encode(truncated);

    await nameCharacteristicRef.current.writeValue(data);
    console.log('Device name sent:', truncated);

    return truncated;
  }, []);

  // ========================================================================
  // Get Output Value from Proximity
  // Returns 0-255 based on how close the device is
  // ========================================================================
  const getProximityOutputValue = useCallback(() => {
    return proximityToOutputValue(proximityPercent);
  }, [proximityPercent]);

  return {
    connectedDevice,
    connect,
    connectToKnown,
    disconnect,
    discoveryInProgress,
    startDiscovery,
    sendLedBrightness,
    sendBuzzerVolume,
    sendDeviceName,
    rssi,
    proximityPercent,
    getProximityOutputValue
  };
}

