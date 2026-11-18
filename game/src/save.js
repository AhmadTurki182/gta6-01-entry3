// saveManager: localStorage saves — cash, mission progress, standing,
// owned cars and weapons, and the time of day. Autosaves after each mission.
const KEY = 'paloma-bay-save-v1';

export function createSaveManager() {
  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
      return true;
    } catch (err) {
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (err) { /* storage unavailable */ }
  }

  function hasSave() {
    return load() !== null;
  }

  return { save, load, clear, hasSave };
}
