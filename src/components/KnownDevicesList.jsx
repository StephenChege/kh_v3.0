import React, { useState } from 'react';

// Shows known Keyholders that Chrome can still silently reconnect to
// (no OS picker). Only ever rendered with entries that already passed
// the getDevices() cross-check in App.jsx — if that list is empty
// (no known devices, or unsupported browser like Bluefy/iOS), this
// component renders nothing.
export default function KnownDevicesList({ darkMode, availableKnownDevices, connectToKnown, onConnectSuccess }) {
  const [connectingId, setConnectingId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  if (!availableKnownDevices || availableKnownDevices.length === 0) {
    return null;
  }

  const handleConnect = async (entry) => {
    setErrorId(null);
    setConnectingId(entry.id);

    const result = await connectToKnown(entry.bluetoothDevice);

    setConnectingId(null);

    if (result.success) {
      onConnectSuccess(entry.id);
    } else {
      setErrorId(entry.id);
    }
  };

  const formatLastConnected = (timestamp) => {
    if (!timestamp) return 'never';
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <div className="mb-6">
      <p className={`text-sm mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        Known Keyholders
      </p>
      <div className="space-y-2">
        {availableKnownDevices.map((entry) => (
          <div
            key={entry.id}
            className={`p-3 rounded-lg border flex items-center justify-between ${
              darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div>
              <p className="font-medium">{entry.name}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                Last connected {formatLastConnected(entry.lastConnected)}
              </p>
              {errorId === entry.id && (
                <p className="text-xs text-rose-500 mt-1">Couldn't find it nearby</p>
              )}
            </div>
            <button
              onClick={() => handleConnect(entry)}
              disabled={connectingId === entry.id}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${
                connectingId === entry.id
                  ? darkMode
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-slate-200 text-slate-400'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {connectingId === entry.id ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
