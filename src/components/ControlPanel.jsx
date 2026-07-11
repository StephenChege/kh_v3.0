import React, { useEffect } from 'react';
import ProximityStatus from './ProximityStatus';

export default function ControlPanel({
  ledOn,
  setLedOn,
  ledBrightness,
  setLedBrightness,
  buzzerOn,
  setBuzzerOn,
  buzzerVolume,
  setBuzzerVolume,
  darkMode,
  connectedDevice,
  sendLedBrightness,
  sendBuzzerVolume,
  rssi,
  proximityPercent,
  proximityResponseEnabled,
  onToggleProximityResponse,
  getProximityOutputValue
}) {
  // When Proximity Response is ON, automatically update LED/Buzzer based on
  // proximity. LED and buzzer respond independently — each only auto-adjusts
  // while its own ON/OFF toggle is on, so a user can run proximity mode with
  // just the LED (or just the buzzer) active.
  useEffect(() => {
    if (!proximityResponseEnabled || !connectedDevice) return;

    const outputValue = getProximityOutputValue();
    const outputPercent = Math.round((outputValue / 255) * 100);

    if (ledOn) {
      sendLedBrightness(outputValue);
      setLedBrightness(outputPercent);
    }

    if (buzzerOn) {
      sendBuzzerVolume(outputValue);
      setBuzzerVolume(outputPercent);
    }

    console.log('Proximity Response active: Output value =', outputValue);
  }, [proximityPercent, proximityResponseEnabled, ledOn, buzzerOn, connectedDevice, getProximityOutputValue, sendLedBrightness, sendBuzzerVolume, setLedBrightness, setBuzzerVolume]);

  // When Proximity Response is OFF, send manual slider values
  useEffect(() => {
    if (!proximityResponseEnabled && connectedDevice) {
      if (ledOn) {
        sendLedBrightness(Math.round((ledBrightness * 255) / 100));
      } else {
        sendLedBrightness(0);
      }

      if (buzzerOn) {
        sendBuzzerVolume(Math.round((buzzerVolume * 255) / 100));
      } else {
        sendBuzzerVolume(0);
      }
    }
  }, [ledBrightness, ledOn, buzzerOn, buzzerVolume, connectedDevice, proximityResponseEnabled, sendLedBrightness, sendBuzzerVolume]);

  const cardClass = darkMode 
    ? 'bg-slate-900 border-slate-800' 
    : 'bg-slate-50 border-slate-200';

  const disabledClass = proximityResponseEnabled 
    ? darkMode 
      ? 'opacity-50 bg-slate-800 border-slate-700' 
      : 'opacity-50 bg-slate-100 border-slate-300'
    : '';

  return (
    <div className="space-y-6">
      {/* Proximity Status with Toggle */}
      <ProximityStatus
        rssi={rssi}
        proximityPercent={proximityPercent}
        darkMode={darkMode}
        proximityResponseEnabled={proximityResponseEnabled}
        onToggleProximityResponse={onToggleProximityResponse}
      />

      {/* Info when Proximity Response is Active */}
      {proximityResponseEnabled && (
        <div className={`p-4 rounded-lg border-l-4 border-emerald-500 ${
          darkMode ? 'bg-emerald-500/10' : 'bg-emerald-100'
        }`}>
          <p className={`text-sm ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
            ✓ Proximity Response Active: LED and buzzer automatically adjust based on distance. Turn OFF the toggle to manually control.
          </p>
        </div>
      )}

      {/* LED Control */}
      <div className={`p-6 rounded-lg border ${cardClass} space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">LED</h3>
          <button
            onClick={() => setLedOn(!ledOn)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              ledOn
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : darkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {ledOn ? 'ON' : 'OFF'}
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">Brightness</label>
            <span className={`text-sm font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {ledBrightness}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={ledBrightness}
            onChange={(e) => setLedBrightness(Number(e.target.value))}
            disabled={!ledOn || proximityResponseEnabled}
            className={`w-full accent-amber-500 ${(!ledOn || proximityResponseEnabled) ? 'opacity-50' : ''}`}
          />
          {proximityResponseEnabled && ledOn && (
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Controlled by proximity (slider disabled)
            </p>
          )}
        </div>
      </div>

      {/* Buzzer Control */}
      <div className={`p-6 rounded-lg border ${cardClass} space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Buzzer</h3>
          <button
            onClick={() => setBuzzerOn(!buzzerOn)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              buzzerOn
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : darkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {buzzerOn ? 'ON' : 'OFF'}
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">Volume</label>
            <span className={`text-sm font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {buzzerVolume}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={buzzerVolume}
            onChange={(e) => setBuzzerVolume(Number(e.target.value))}
            disabled={!buzzerOn || proximityResponseEnabled}
            className={`w-full accent-rose-500 ${(!buzzerOn || proximityResponseEnabled) ? 'opacity-50' : ''}`}
          />
          {proximityResponseEnabled && buzzerOn && (
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Controlled by proximity (slider disabled)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
