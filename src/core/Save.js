/**
 * localStorage-backed progress: how many main tracks are unlocked and the best
 * time per track. Fails safe (in-memory) if storage is unavailable.
 *
 * Unlock model:
 *   - Main tracks unlock linearly (beat one to open the next), capped at the
 *     number of main (non-bonus) tracks.
 *   - A bonus track is unlocked when its `gated` flag is false (available now)
 *     OR — once gated — when every main track has been completed.
 */
import { TRACK_DEFS, MAIN_TRACKS, MAIN_TRACK_COUNT } from '../level/tracks.js';
import { BEATS } from '../story/story.js';

const KEY = 'cappyracer.save.v1';

const DEFAULTS = { unlocked: 1, best: {}, beats: {} }; // track 0 unlocked by default

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULTS };
}

let data = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export const Save = {
  /** Number of MAIN tracks unlocked (indices 0..unlocked-1 are playable). */
  unlockedCount() { return data.unlocked; },

  /** Has every main track been completed (a best time recorded)? */
  allMainComplete() { return MAIN_TRACKS.every((d) => data.best[d.id] != null); },

  isUnlocked(index) {
    const def = TRACK_DEFS[index];
    if (!def) return false;
    if (def.bonus) return def.gated ? Save.allMainComplete() : true;
    return index < data.unlocked;
  },

  /** Unlock up to `count` main tracks (never locks back; capped at main count). */
  unlockUpTo(count) {
    const c = Math.min(count, MAIN_TRACK_COUNT);
    if (c > data.unlocked) { data.unlocked = c; persist(); }
  },

  bestTime(trackId) { return data.best[trackId] ?? null; },

  /** Story beats: track which cinematics the player has already seen. */
  hasSeenBeat(id) { return !!(data.beats && data.beats[id]); },
  markBeatSeen(id) {
    if (!data.beats) data.beats = {};
    if (!data.beats[id]) { data.beats[id] = true; persist(); }
  },

  /** Record a finish time if it beats the stored best. Returns true if new best. */
  recordTime(trackId, time) {
    const prev = data.best[trackId];
    if (prev == null || time < prev) { data.best[trackId] = time; persist(); return true; }
    return false;
  },

  /** Test helper: wipe saved progress. */
  reset() { data = { ...DEFAULTS, best: {}, beats: {} }; persist(); },

  /** Test helper: mark every story beat seen (skip cinematics). */
  markAllBeatsSeen() {
    data.beats = data.beats || {};
    for (const id of Object.keys(BEATS)) data.beats[id] = true;
    persist();
  },
};
