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
    // Free-cruise: show the near-miss score + combo instead of lap/position.
    if (state.endless) {
      this.el.innerHTML =
        `<div style="font-size:13px;letter-spacing:3px;color:#bfe3ff">FREE CRUISE</div>` +
        `<div style="font-size:38px;font-weight:700;color:#fff;line-height:1.05">${Math.round(state.score).toLocaleString()}</div>` +
        `<div style="font-size:26px;color:#ffd54a">x${state.combo}<span style="font-size:13px;color:#dfe7ff;opacity:.8"> COMBO</span></div>` +
        `<div style="font-size:14px;opacity:.75;margin-top:2px">${Math.round(Math.abs(state.speed))} u/s · <span style="opacity:.8">Esc to exit</span></div>`;
      return;
    }

    const total = state.totalLaps || RACE.LAPS;
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
      this.flowBar(state.flow == null ? 0 : state.flow) +
      item;
  }

  /**
   * Momentum/chill-streak gauge. Fills + escalates as you snowball: a calm teal
   * crawl -> hot gold boulder. The tier word is the hype ("UNSTOPPABLE" / "BOULDER").
   */
  flowBar(flow) {
    const pct = Math.round(flow * 100);
    const tiers = [
      [0.95, 'BOULDER',      '#fff0a0', '🌀'],
      [0.7,  'UNSTOPPABLE',  '#ff8c1a', '😎'],
      [0.35, 'ROLLING',      '#7be0a0', '🙂'],
      [0.0,  'CHILL',        '#49d6ff', '😌'],
    ];
    const [, label, color, face] = tiers.find(([t]) => flow >= t);
    const glow = flow > 0.9 ? `0 0 16px ${color},0 0 4px #fff` : `0 0 8px ${color}`;
    return (
      `<div style="margin-top:8px;font-size:14px;letter-spacing:2px;font-weight:700;color:${color}">` +
      `${face} ${label}</div>` +
      `<div style="width:180px;height:13px;border-radius:7px;background:rgba(0,0,0,.35);` +
      `box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);overflow:hidden;margin-top:2px">` +
      `<div style="width:${pct}%;height:100%;background:${color};` +
      `box-shadow:${glow};transition:width .1s linear,background .25s"></div></div>`
    );
  }
}
