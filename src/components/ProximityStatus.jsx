import React from 'react';

export default function ProximityStatus({
  rssi,
  proximityPercent,
  darkMode,
  proximityResponseEnabled,
  onToggleProximityResponse
}) {
  const cardClass = darkMode 
    ? 'bg-slate-900 border-slate-800' 
    : 'bg-slate-50 border-slate-200';

  return (
    <div className={`p-4 rounded-lg border ${cardClass} mb-6`}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium">Distance Status</p>
        <span className={`text-xs px-2 py-1 rounded ${
          proximityResponseEnabled
            ? 'bg-emerald-500/20 text-emerald-400'
            : darkMode
              ? 'bg-slate-800 text-slate-400'
              : 'bg-slate-200 text-slate-600'
        }`}>
          {proximityResponseEnabled ? '🔴 Active' : '⚪ Inactive'}
        </span>
      </div>

      {rssi !== null ? (
        <>
          <p className={`text-sm mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            RSSI: {rssi} dBm
          </p>
          
          {/* Proximity Bar */}
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${proximityPercent}%` }}
            ></div>
          </div>
          
          <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Proximity: {proximityPercent}% (Far ← → Close)
          </p>
        </>
      ) : (
        <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Searching for signal...
        </p>
      )}

      {/* Proximity Response Toggle */}
      <div className="border-t border-slate-700 pt-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>
              Proximity Response
            </p>
            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Auto-adjust LED & buzzer with distance
            </p>
          </div>
          <button
            onClick={onToggleProximityResponse}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              proximityResponseEnabled ? 'bg-emerald-600' : 'bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                proximityResponseEnabled ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
