import React, { useState, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import Settings from './components/Settings';
import KnownDevicesList from './components/KnownDevicesList';
import useBLE from './hooks/useBLE';
import { getKnownDevices, saveKnownDevice, updateLastConnected } from './storage';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('keyholder-theme');
    return saved ? saved === 'dark' : true;
  });
  
  const [showSettings, setShowSettings] = useState(false);

  // Known Keyholders (id, name, lastConnected), loaded from storage.js.
  // Replaces the old flat deviceNames object — same purpose (friendly
  // name per physical device), richer shape so we can build history/
  // reconnect features on top of it.
  const [knownDevices, setKnownDevices] = useState(() => getKnownDevices());

  // Devices Chrome still remembers permission for (Chrome/Android only —
  // feature-detected below). Cross-referenced with knownDevices so we know
  // which known Keyholders can attempt a silent reconnect (no OS picker).
  const [availableKnownDevices, setAvailableKnownDevices] = useState([]);

  // TEMPORARY DEBUG STATE — remove once "Known Keyholders" issue is diagnosed.
  const [debugInfo, setDebugInfo] = useState('checking...');
  
  // Proximity Response Toggle
  const [proximityResponseEnabled, setProximityResponseEnabled] = useState(() => {
    const saved = localStorage.getItem('keyholder-proximity-response');
    return saved ? saved === 'true' : false;
  });

  // Distance Status card visibility (separate from proximity mode itself —
  // hiding the bar does not stop proximity auto-control from running)
  const [showDistanceStatus, setShowDistanceStatus] = useState(true);
  
  // LED state
  const [ledOn, setLedOn] = useState(false);
  const [ledBrightness, setLedBrightness] = useState(50);
  
  // Buzzer state
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [buzzerVolume, setBuzzerVolume] = useState(50);

  // Last manual slider values, saved when proximity mode turns on so they
  // can be restored when it turns back off
  const [lastManualLedBrightness, setLastManualLedBrightness] = useState(50);
  const [lastManualBuzzerVolume, setLastManualBuzzerVolume] = useState(50);

  const { 
    connectedDevice, 
    connect, 
    connectToKnown,
    disconnect, 
    discoveryInProgress,
    startDiscovery,
    sendLedBrightness,
    sendBuzzerVolume,
    rssi,
    proximityPercent,
    getProximityOutputValue
  } = useBLE();

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('keyholder-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Save proximity response preference
  useEffect(() => {
    localStorage.setItem('keyholder-proximity-response', proximityResponseEnabled ? 'true' : 'false');
  }, [proximityResponseEnabled]);

  // On load, check which known Keyholders Chrome still has permission for.
  // getDevices() is Chrome/Android-only — feature-detect and skip silently
  // elsewhere (e.g. Bluefy on iOS has no such API).
  useEffect(() => {
    if (!navigator.bluetooth?.getDevices) {
      setAvailableKnownDevices([]);
      setDebugInfo(`Known: ${knownDevices.length} | getDevices() NOT SUPPORTED on this browser`);
      return;
    }

    navigator.bluetooth.getDevices()
      .then((devices) => {
        const matched = devices
          .map((device) => {
            const known = knownDevices.find((d) => d.id === device.id);
            return known ? { ...known, bluetoothDevice: device } : null;
          })
          .filter(Boolean);
        setAvailableKnownDevices(matched);
        setDebugInfo(`Known: ${knownDevices.length} | Chrome remembers: ${devices.length} | Matched: ${matched.length}`);
      })
      .catch((err) => {
        console.error('getDevices() failed:', err);
        setAvailableKnownDevices([]);
        setDebugInfo(`Known: ${knownDevices.length} | getDevices() ERROR: ${err.message}`);
      });
  }, [knownDevices]);

  const handleAddDevice = async () => {
    await startDiscovery();
  };

  // Called by KnownDevicesList after a successful silent reconnect.
  // Bumps the device's lastConnected timestamp and refreshes knownDevices
  // so the list re-sorts with most-recently-used first.
  const handleKnownDeviceConnected = (id) => {
    updateLastConnected(id);
    setKnownDevices(getKnownDevices());
  };

  // Friendly name for the currently connected device: look up by its
  // Bluetooth ID in knownDevices, fall back to the raw BLE advertised
  // name, then a generic default if neither is available.
  const deviceName = connectedDevice
    ? (knownDevices.find((d) => d.id === connectedDevice.id)?.name || connectedDevice.name || 'My Keyholder')
    : 'My Device';

  const handleRenameDevice = (newName) => {
    if (!connectedDevice) return;
    saveKnownDevice(connectedDevice.id, newName);
    setKnownDevices(getKnownDevices());
  };

  const handleDisconnect = () => {
    disconnect();
    setLedOn(false);
    setBuzzerOn(false);
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all settings? This will clear device names and theme preferences.')) {
      localStorage.clear();
      setKnownDevices([]);
      setAvailableKnownDevices([]);
      setDarkMode(true);
      setProximityResponseEnabled(false);
      setLedOn(false);
      setBuzzerOn(false);
      handleDisconnect();
    }
  };

  const handleToggleProximityResponse = () => {
    if (!proximityResponseEnabled) {
      // Turning proximity mode ON: remember the current manual slider
      // positions so they can be restored when it's turned back off.
      setLastManualLedBrightness(ledBrightness);
      setLastManualBuzzerVolume(buzzerVolume);
    } else {
      // Turning proximity mode OFF: restore the manual slider positions.
      // ControlPanel's manual-mode effect will pick up this state change
      // and send the restored values over BLE automatically.
      setLedBrightness(lastManualLedBrightness);
      setBuzzerVolume(lastManualBuzzerVolume);
    }
    setProximityResponseEnabled(!proximityResponseEnabled);
  };

  const handleToggleDistanceStatus = () => {
    setShowDistanceStatus(!showDistanceStatus);
  };

  const bgClass = darkMode ? 'bg-slate-950' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-slate-900';
  const borderClass = darkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className={`${bgClass} ${textClass} min-h-screen transition-colors`}>
      {/* Header */}
      <header className={`border-b ${borderClass} sticky top-0 z-50`}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Keyholder</h1>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {connectedDevice ? `Connected to ${deviceName}` : 'No device connected'}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
            title="Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>
      
      {/* Settings Panel */}
      {showSettings && (
        <Settings
          darkMode={darkMode}
          onThemeToggle={() => setDarkMode(!darkMode)}
          connectedDevice={connectedDevice}
          deviceName={deviceName}
          onRenameDevice={handleRenameDevice}
          onDisconnect={handleDisconnect}
          onResetSettings={handleResetAll}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {/* Device Connection */}
        {!connectedDevice && (
          <>
            <KnownDevicesList
              darkMode={darkMode}
              availableKnownDevices={availableKnownDevices}
              connectToKnown={connectToKnown}
              onConnectSuccess={handleKnownDeviceConnected}
            />

            <div className={`p-6 rounded-lg border-2 border-dashed ${
              darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-300 bg-slate-100'
            } text-center mb-6`}>
              <p className={`mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                No device connected
              </p>
              <button
                onClick={handleAddDevice}
                disabled={discoveryInProgress}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  discoveryInProgress
                    ? darkMode
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-slate-200 text-slate-400'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {discoveryInProgress ? 'Scanning...' : 'Connect New Device'}
              </button>
            </div>
          </>
        )}

        {/* Control Panel */}
        {connectedDevice && (
          <>
            <ControlPanel
              ledOn={ledOn}
              setLedOn={setLedOn}
              ledBrightness={ledBrightness}
              setLedBrightness={setLedBrightness}
              buzzerOn={buzzerOn}
              setBuzzerOn={setBuzzerOn}
              buzzerVolume={buzzerVolume}
              setBuzzerVolume={setBuzzerVolume}
              darkMode={darkMode}
              connectedDevice={connectedDevice}
              sendLedBrightness={sendLedBrightness}
              sendBuzzerVolume={sendBuzzerVolume}
              rssi={rssi}
              proximityPercent={proximityPercent}
              proximityResponseEnabled={proximityResponseEnabled}
              onToggleProximityResponse={handleToggleProximityResponse}
              showDistanceStatus={showDistanceStatus}
              onToggleDistanceStatus={handleToggleDistanceStatus}
              getProximityOutputValue={getProximityOutputValue}
            />

            <button
              onClick={handleDisconnect}
              className="w-full mt-6 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-all"
            >
              Disconnect
            </button>
          </>
        )}
      </main>
    </div>
  );
}
