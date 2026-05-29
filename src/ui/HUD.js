import { eventBus, Events } from '../core/EventBus.js';
import { RACE } from '../core/Constants.js';

/** Formats seconds as m:ss.cs (e.g. 75.3 -> "1:15.30"). */
export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

/** 1 -> "1st", 2 -> "2nd", etc. */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.countdownEl = document.getElementById('countdown');
    this.el.style.display = 'none';
    eventBus.on(Events.GAME_RESTART, () => { this.hide(); this.setCountdown(''); });
  }

  show() {
    this.el.style.display = 'block';
  }

  hide() {
    this.el.style.display = 'none';
  }

  /** Big centered 3-2-1-GO! text. Empty string hides it. */
  setCountdown(label) {
    if (!label) { this.countdownEl.style.display = 'none'; return; }
    this.countdownEl.textContent = label;
    this.countdownEl.classList.toggle('go', label === 'GO!');
    this.countdownEl.style.display = 'flex';
  }

  update(state) {
    const total = RACE.LAPS;
    const lap = Math.min(state.lap + (state.finished ? 0 : 1), total);
    const offTrack = !state.onTrack
      ? ` <span style="color:#ffd54a">OFF-TRACK</span>`
      : '';
    const pos = state.totalRacers > 1
      ? `<div style="font-size:30px;color:#ffd54a">${ordinal(state.position)} <span style="font-size:18px;color:#fff">/ ${state.totalRacers}</span></div>`
      : '';
    const icons = { shell: '🍊', mud: '🟤', melon: '🍈' };
    const item = state.heldItem
      ? `<div style="font-size:24px">ITEM ${icons[state.heldItem] || ''} <span style="font-size:14px;opacity:0.8">[Space]</span></div>`
      : '';
    this.el.innerHTML =
      pos +
      `<div style="font-size:26px">LAP ${lap}/${total}${offTrack}</div>` +
      `<div style="font-size:22px;opacity:0.9">${formatTime(state.raceTime)}</div>` +
      item;
  }
}
