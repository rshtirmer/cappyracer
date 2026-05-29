/**
 * localStorage-backed progress: how many tracks are unlocked and the best time
 * per track. Fails safe (in-memory) if storage is unavailable.
 */
const KEY = 'cappyracer.save.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { unlocked: 1, best: {} }; // track 0 unlocked by default
}

let data = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export const Save = {
  /** Number of tracks unlocked (indices 0..unlocked-1 are playable). */
  unlockedCount() { return data.unlocked; },

  isUnlocked(index) { return index < data.unlocked; },

  /** Unlock up to `count` tracks (never locks back). */
  unlockUpTo(count) {
    if (count > data.unlocked) { data.unlocked = count; persist(); }
  },

  bestTime(trackId) { return data.best[trackId] ?? null; },

  /** Record a finish time if it beats the stored best. Returns true if new best. */
  recordTime(trackId, time) {
    const prev = data.best[trackId];
    if (prev == null || time < prev) { data.best[trackId] = time; persist(); return true; }
    return false;
  },

  /** Test helper: wipe saved progress. */
  reset() { data = { unlocked: 1, best: {} }; persist(); },
};
