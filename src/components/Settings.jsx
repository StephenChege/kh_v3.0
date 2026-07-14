import React, { useState } from 'react';

const MAX_NAME_LENGTH = 20;

export default function Settings({
  darkMode,
  onThemeToggle,
  connectedDevice,
  deviceName,
  onRenameDevice,
  onDisconnect,
  onResetSettings
}) {
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [newName, setNewName] = useState(deviceName);
  const [isSaving, setIsSaving] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName === deviceName) return;

    setIsSaving(true);
    try {
      // onRenameDevice writes to the firmware over BLE and only saves
      // locally if that succeeds — this call can take a moment (a real
      // BLE write), hence the isSaving state so the button doesn't look
      // unresponsive while it's in flight.
      await onRenameDevice(newName);
      setShowRenameInput(false);
    } finally {
      setIsSaving(false);
    }
  };

  const cardClass = darkMode 
    ? 'bg-slate-900 border-slate-800' 
    : 'bg-slate-50 border-slate-200';

  const inputClass = darkMode
    ? 'bg-slate-800 border-slate-700 text-white'
    : 'bg-white border-slate-300 text-slate-900';

  return (
    <div className={`border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Theme Toggle */}
        <div className={`p-4 rounded-lg border ${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Toggle theme preference
              </p>
            </div>
            <button
              onClick={onThemeToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                darkMode ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  darkMode ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Device Settings */}
        {connectedDevice && (
          <div className={`p-4 rounded-lg border ${cardClass}`}>
            <p className="font-medium mb-4">Device Settings</p>
            
            <div className="space-y-4">
              {/* Device Name */}
              <div>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Device Name
                </p>
                {showRenameInput ? (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        maxLength={MAX_NAME_LENGTH}
                        className={`flex-1 px-3 py-2 rounded border ${inputClass}`}
                        placeholder="Device name"
                        autoFocus
                        disabled={isSaving}
                      />
                      <button
                        onClick={handleRename}
                        disabled={isSaving}
                        className={`px-3 py-2 rounded font-medium text-white ${
                          isSaving
                            ? 'bg-emerald-800 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setShowRenameInput(false);
                          setNewName(deviceName);
                        }}
                        disabled={isSaving}
                        className={`px-3 py-2 rounded border ${cardClass}`}
                      >
                        Cancel
                      </button>
                    </div>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      Max {MAX_NAME_LENGTH} characters. This updates the name shown when scanning for your Keyholder, not just in this app.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-mono text-sm">{deviceName}</p>
                    <button
                      onClick={() => setShowRenameInput(true)}
                      className="text-emerald-500 hover:text-emerald-600 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Device ID */}
              <div>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Device ID
                </p>
                <p className="font-mono text-xs mt-1">{connectedDevice.id}</p>
              </div>

              {/* Disconnect Button */}
              <button
                onClick={() => {
                  if (window.confirm(`Disconnect from ${deviceName}?`)) {
                    onDisconnect();
                  }
                }}
                className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-all"
              >
                Disconnect Device
              </button>
            </div>
          </div>
        )}

        {/* App Settings */}
        <div className={`p-4 rounded-lg border ${cardClass}`}>
          <p className="font-medium mb-4">App Settings</p>
          
          <button
            onClick={() => {
              if (window.confirm('Reset all settings? This will clear device names and preferences.')) {
                onResetSettings();
              }
            }}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
          >
            Reset All Settings
          </button>
          <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            This will clear device names, theme preference, and connection state.
          </p>
        </div>

        {/* About */}
        <div className={`p-4 rounded-lg border ${cardClass}`}>
          <p className="font-medium mb-2">About</p>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Keyholder PWA v3.1
          </p>
          <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            A proximity key-finder with BLE connectivity and independent LED/buzzer control.
          </p>
        </div>
      </div>
    </div>
  );
}