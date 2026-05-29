import { eventBus, Events } from '../core/EventBus.js';
import { formatTime, ordinal } from './HUD.js';
import { TRACK_DEFS } from '../level/tracks.js';
import { Save } from '../core/Save.js';
import { drawTrackPreview } from './trackPreview.js';

const DIFF_CLASS = { Easy: 'easy', Hard: 'hard', Expert: 'expert', Bonus: 'bonus' };

export class Menu {
  constructor() {
    this.menuOverlay = document.getElementById('menu-overlay');
    this.finishOverlay = document.getElementById('gameover-overlay');
    this.playBtn = document.getElementById('play-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.finalTimeEl = document.getElementById('final-score');
    this.bestTimeEl = document.getElementById('best-score');
    this.trackSelectEl = document.getElementById('track-select');

    // Match Game's initially-built track (?track=N, default 0).
    const startIdx = parseInt(new URLSearchParams(location.search).get('track'), 10) || 0;
    this.selected = Save.isUnlocked(startIdx) ? startIdx : 0;

    this.playBtn.addEventListener('click', () => {
      this.menuOverlay.classList.add('hidden');
      eventBus.emit(Events.GAME_START);
    });
    this.restartBtn.addEventListener('click', () => {
      this.finishOverlay.classList.add('hidden');
      eventBus.emit(Events.GAME_RESTART);
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

  showFinish({ place, total, time, newBest, unlockedNew, trackName }) {
    const won = place === 1;
    this.finalTimeEl.textContent = `${ordinal(place)} place / ${total}  ·  ${trackName}`;
    const bits = [`${won ? '🏆 You won!' : 'Time'} ${formatTime(time)}`];
    if (newBest) bits.push('⭐ New best!');
    if (unlockedNew) bits.push('🔓 New track unlocked!');
    this.bestTimeEl.textContent = bits.join('  ·  ');
    this.finishOverlay.classList.remove('hidden');
  }
}
