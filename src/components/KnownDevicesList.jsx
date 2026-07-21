import React, { useState } from 'react';
import { removeKnownDevice } from '../storage';

// Shows known Keyholders that Chrome can still silently reconnect to
// (no OS picker). Only ever rendered with entries that already passed
// the getDevices() cross-check in App.jsx — if that list is empty
// (no known devices, or unsupported browser like Bluefy/iOS), this
// component renders nothing.
//
// onDeviceForgotten(id) is called after a device is removed from
// localStorage, so the parent can drop it from availableKnownDevices.
export default function KnownDevicesList({ darkMode, availableKnownDevices, connectToKnown, onConnectSuccess, onDeviceForgotten }) {
  const [connectingId, setConnectingId] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

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

  const handleDeleteClick = (entryId) => {
    setConfirmingDeleteId(entryId);
  };

  const handleCancelDelete = () => {
    setConfirmingDeleteId(null);
  };

  const handleConfirmDelete = (entryId) => {
    removeKnownDevice(entryId);
    setConfirmingDeleteId(null);
    if (onDeviceForgotten) {
      onDeviceForgotten(entryId);
    }
  };

  const toggleExpanded = (entryId) => {
    setExpandedIds((prev) => ({ ...prev, [entryId]: !prev[entryId] }));
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
        {availableKnownDevices.map((entry) => {
          const isExpanded = !!expandedIds[entry.id];
          const isConfirmingDelete = confirmingDeleteId === entry.id;

          return (
            <div
              key={entry.id}
              className={`p-3 rounded-lg border ${
                darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{entry.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      darkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    {isExpanded ? 'Hide' : 'Show'}
                  </button>

                  {isConfirmingDelete ? (
                    <>
                      <button
                        onClick={() => handleConfirmDelete(entry.id)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          darkMode
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleConnect(entry)}
                        disabled={connectingId === entry.id}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          connectingId === entry.id
                            ? darkMode
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-slate-200 text-slate-400'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {connectingId === entry.id ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(entry.id)}
                        aria-label={`Delete ${entry.name}`}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          darkMode
                            ? 'bg-slate-800 hover:bg-rose-900/60 text-rose-400'
                            : 'bg-slate-200 hover:bg-rose-100 text-rose-600'
                        }`}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Last connected {formatLastConnected(entry.lastConnected)}
                  </p>
                  {errorId === entry.id && (
                    <p className="text-xs text-rose-500 mt-1">Couldn't find it nearby</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
