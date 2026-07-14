// storage.js
// Centralized localStorage handling for known Keyholder devices.
// Replaces the old raw "deviceNames" object with a structured list:
// [{ id, name, lastConnected }]

const STORAGE_KEY = "knownDevices";

// Get the full list of known devices, sorted most-recently-connected first.
export function getKnownDevices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.lastConnected || 0) - (a.lastConnected || 0));
  } catch (err) {
    console.error("storage.js: failed to read known devices", err);
    return [];
  }
}

// Get a single known device by id, or null if not found.
export function getKnownDevice(id) {
  const devices = getKnownDevices();
  return devices.find((d) => d.id === id) || null;
}

// Save (or update) a device's name. Creates the entry if it doesn't exist yet.
// Does NOT change lastConnected — renaming shouldn't bump connection order.
export function saveKnownDevice(id, name) {
  try {
    const devices = getKnownDevices();
    const existing = devices.find((d) => d.id === id);

    if (existing) {
      existing.name = name;
    } else {
      devices.push({ id, name, lastConnected: Date.now() });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (err) {
    console.error("storage.js: failed to save known device", err);
  }
}

// Update the lastConnected timestamp for a device (call this on every successful connect).
// If the device isn't known yet, this won't create it — use saveKnownDevice for that.
export function updateLastConnected(id) {
  try {
    const devices = getKnownDevices();
    const existing = devices.find((d) => d.id === id);
    if (!existing) return;

    existing.lastConnected = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (err) {
    console.error("storage.js: failed to update last connected", err);
  }
}

// Remove a device from the known list entirely (not used yet in V3.1, but useful for later "forget this device" UI).
export function removeKnownDevice(id) {
  try {
    const devices = getKnownDevices().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (err) {
    console.error("storage.js: failed to remove known device", err);
  }
}
