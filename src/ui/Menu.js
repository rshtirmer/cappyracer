import { eventBus, Events } from '../core/EventBus.js';
import { formatTime, ordinal } from './HUD.js';
import { TRACK_DEFS } from '../level/tracks.js';
import { Save } from '../core/Save.js';
import { drawTrackPreview } from './trackPreview.js';

const DIFF_CLASS = { Easy: 'easy', Hard: 'hard', Expert: 'expert', Bonus: 'bonus', Cruise: 'cruise' };

export class Menu {
  constructor() {
    this.menuOverlay = document.getElementById('menu-overlay');
    this.finishOverlay = document.getElementById('gameover-overlay');
    this.playBtn = document.getElementById('play-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.continueBtn = document.getElementById('continue-btn');
    this.finalTimeEl = document.getElementById('final-score');
    this.bestTimeEl = document.getElementById('best-score');
    this.standingsEl = document.getElementById('standings');
    this.trackSelectEl = document.getElementById('track-select');
    this._winBeat = null;

    // Match Game's initially-built track (?track=N, default 0).
    const startIdx = parseInt(new URLSearchParams(location.search).get('track'), 10) || 0;
    this.selected = Save.isUnlocked(startIdx) ? startIdx : 0;

    this.playBtn.addEventListener('click', () => {
      this.menuOverlay.classList.add('hidden');
      eventBus.emit(Events.RACE_REQUESTED, this.selected);
    });
    this.restartBtn.addEventListener('click', () => {
      this.finishOverlay.classList.add('hidden');
      eventBus.emit(Events.GAME_RESTART);
    });
    if (this.continueBtn) this.continueBtn.addEventListener('click', () => {
      this.finishOverlay.classList.add('hidden');
      const beat = this._winBeat;
      this._winBeat = null;
      if (beat) eventBus.emit(Events.CUTSCENE_PLAY, beat);
      else eventBus.emit(Events.GAME_RESTART);
    });

    eventBus.on(Events.RACE_FINISHED, (data) => this.showFinish(data));

    this.buildTracks();
  }

  buildTracks() {
    this.trackSelectEl.innerHTML = '';
    TRACK_DEFS.forEach((def, i) => {
      const unlocked = Save.isUnlocked(i);
      const tile = document.createElement('div');
      tile.className = 'track-tile'
        + (i === this.selected ? ' selected' : '')
        + (unlocked ? '' : ' locked')
        + (def.bonus ? ' bonus' : '');

      const best = Save.bestTime(def.id);
      const info = !unlocked
        ? '🔒 Locked'
        : (best != null ? `⭐ Best ${formatTime(best)}` : 'Not raced yet');
      const diffClass = DIFF_CLASS[def.difficulty] || 'easy';

      // Preview canvas (rendered top-down map of the track).
      const canvas = document.createElement('canvas');
      canvas.className = 'tprev';
      canvas.width = 300;
      canvas.height = 168;

      const body = document.createElement('div');
      body.className = 'tbody';
      body.innerHTML =
        `<div class="trow">` +
          `<span class="tname">${i + 1}. ${def.name}</span>` +
          `<span class="badge ${diffClass}">${def.difficulty}</span>` +
        `</div>` +
        `<div class="tinfo">${info}</div>`;

      tile.appendChild(canvas);
      if (def.bonus) {
        const ribbon = document.createElement('div');
        ribbon.className = 'ribbon';
        ribbon.textContent = 'BONUS';
        tile.appendChild(ribbon);
      }
      tile.appendChild(body);
      if (!unlocked) {
        const veil = document.createElement('div');
        veil.className = 'lock-veil';
        veil.textContent = '🔒';
        tile.appendChild(veil);
      }

      drawTrackPreview(canvas, def);

      if (unlocked) {
        tile.addEventListener('click', () => {
          this.selected = i;
          eventBus.emit(Events.TRACK_SELECT, i);
          this.buildTracks();
        });
      }
      this.trackSelectEl.appendChild(tile);
    });

    this.updatePlayLabel();
  }

  updatePlayLabel() {
    const def = TRACK_DEFS[this.selected];
    if (def && this.playBtn) this.playBtn.textContent = `▶  RACE · ${def.name}`;
  }

  showStart() {
    this.buildTracks();
    this.menuOverlay.classList.remove('hidden');
    this.finishOverlay.classList.add('hidden');
  }

  /** Hide both menu overlays (used when a cutscene takes over the screen). */
  hideAll() {
    this.menuOverlay.classList.add('hidden');
    this.finishOverlay.classList.add('hidden');
  }

  showFinish({ place, total, time, newBest, unlockedNew, trackName, winBeat, standings }) {
    const won = place === 1;
    this.finalTimeEl.textContent = `${ordinal(place)} place / ${total}  ·  ${trackName}`;
    const bits = [`${won ? '🏆 You won!' : 'Time'} ${formatTime(time)}`];
    if (newBest) bits.push('⭐ New best!');
    if (unlockedNew) bits.push('🔓 New track unlocked!');
    this.bestTimeEl.textContent = bits.join('  ·  ');

    this.renderStandings(standings, time);

    // A story beat is pending → offer "Continue Story" as the primary action.
    this._winBeat = winBeat || null;
    if (this.continueBtn) this.continueBtn.style.display = winBeat ? 'inline-block' : 'none';

    this.finishOverlay.classList.remove('hidden');
  }

  /** Render the full finishing order (1st–6th), player row highlighted. */
  renderStandings(standings, playerTime) {
    if (!this.standingsEl) return;
    if (!standings || !standings.length) { this.standingsEl.innerHTML = ''; return; }
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const winnerTime = standings[0] && standings[0].time;
    this.standingsEl.innerHTML = standings.map((s) => {
      const pos = medals[s.place] || `${s.place}.`;
      let right;
      if (s.time != null) {
        const gap = winnerTime != null && s.place > 1 ? `+${formatTime(s.time - winnerTime)}` : formatTime(s.time);
        right = gap;
      } else {
        right = 'DNF';
      }
      return (
        `<div class="standing-row${s.isPlayer ? ' me' : ''}">` +
          `<span class="st-pos">${pos}</span>` +
          `<span class="st-name">${s.name}${s.isPlayer ? ' <b>(You)</b>' : ''}</span>` +
          `<span class="st-time">${right}</span>` +
        `</div>`
      );
    }).join('');
  }
}
