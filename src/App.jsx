import React, { useState, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import Settings from './components/Settings';
import useBLE from './hooks/useBLE';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('keyholder-theme');
    return saved ? saved === 'dark' : true;
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('keyholder-device-name') || 'My Device';
  });
  
  // Proximity Response Toggle
  const [proximityResponseEnabled, setProximityResponseEnabled] = useState(() => {
    const saved = localStorage.getItem('keyholder-proximity-response');
    return saved ? saved === 'true' : false;
  });
  
  // LED state
  const [ledOn, setLedOn] = useState(false);
  const [ledBrightness, setLedBrightness] = useState(50);
  
  // Buzzer state
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [buzzerVolume, setBuzzerVolume] = useState(50);

  const { 
    connectedDevice, 
    connect, 
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

  // Save device name
  useEffect(() => {
    if (deviceName) {
      localStorage.setItem('keyholder-device-name', deviceName);
    }
  }, [deviceName]);

  // Save proximity response preference
  useEffect(() => {
    localStorage.setItem('keyholder-proximity-response', proximityResponseEnabled ? 'true' : 'false');
  }, [proximityResponseEnabled]);

  const handleAddDevice = async () => {
    await startDiscovery();
  };

  const handleDisconnect = () => {
    disconnect();
    setLedOn(false);
    setBuzzerOn(false);
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all settings? This will clear device names and theme preferences.')) {
      localStorage.clear();
      setDeviceName('My Device');
      setDarkMode(true);
      setProximityResponseEnabled(false);
      setLedOn(false);
      setBuzzerOn(false);
      handleDisconnect();
    }
  };

  const handleToggleProximityResponse = () => {
    setProximityResponseEnabled(!proximityResponseEnabled);
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
          onRenameDevice={(newName) => setDeviceName(newName)}
          onDisconnect={handleDisconnect}
          onResetSettings={handleResetAll}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {/* Device Connection */}
        {!connectedDevice && (
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
              {discoveryInProgress ? 'Scanning...' : 'Connect Device'}
            </button>
          </div>
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
