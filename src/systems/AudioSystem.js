import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { KART, DRIFT } from '../core/Constants.js';

/**
 * AudioSystem — zero-dependency procedural Web Audio.
 *
 * Architecture fit: a System that READS the GameState singleton (engine pitch,
 * drift charge, countdown) each frame and LISTENS to the EventBus for discrete
 * cues (pickup / use / hit / boost / lap / finish). It emits no events.
 *
 * Browser-policy safe: the AudioContext is created lazily on the first user
 * gesture and everything is guarded by `_live()`, so headless tests with no
 * gesture stay completely silent and error-free.
 *
 *   master ─┬─ musicGain ── music notes
 *           └─ sfxGain  ──┬─ engine hum (continuous, pitch tracks speed)
 *                         ├─ drift-charge whine (continuous)
 *                         └─ one-shot SFX
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engine = null;   // { osc, filter, gain }
    this.whine = null;    // { osc, gain }
    this._noiseBuf = null;

    this.muted = this._loadMuted();
    this.MUSIC_BASE = 0.42; // music sub-bus level (relative to master)

    // Countdown edge-tracking (read from gameState each frame).
    this._lastBeep = null;
    this._goPlayed = false;

    // Music scheduler (lookahead).
    this._musicMode = 'menu'; // 'menu' | 'gameplay' | null
    this._nextNoteTime = 0;
    this._step = 0;

    this._subscribe();
    this._installUnlock();
    this._installMuteButton();
  }

  // --- Lifecycle / unlock ----------------------------------------------------

  _live() { return this.ctx && this.ctx.state === 'running'; }

  _installUnlock() {
    const unlock = (e) => {
      // Only a REAL user gesture may start audio. Ignoring synthetic events also
      // keeps the headless test suite (which fires dispatchEvent keydowns)
      // completely silent — no AudioContext, no autoplay warning.
      if (e && e.isTrusted === false) return;
      this._ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  _ensureContext() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(ctx.destination);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.MUSIC_BASE;
      this.musicGain.connect(this.master);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);

      // Shared 1s white-noise buffer for whooshes / impacts.
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;

      this.ctx = ctx;
      this._buildEngine();
      this._buildWhine();
      this._nextNoteTime = ctx.currentTime + 0.08;
    } catch (e) {
      console.warn('Audio unavailable:', e);
      this.ctx = null;
    }
  }

  _buildEngine() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 46;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    osc.start();
    this.engine = { osc, filter, gain };
  }

  _buildWhine() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 420;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(hp); hp.connect(gain); gain.connect(this.sfxGain);
    osc.start();
    this.whine = { osc, gain };
  }

  // --- Mute ------------------------------------------------------------------

  _loadMuted() {
    try { return localStorage.getItem('cappy.muted') === '1'; } catch { return false; }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('cappy.muted', this.muted ? '1' : '0'); } catch { /* private mode */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
    this._syncMuteButton();
  }

  _installMuteButton() {
    const btn = document.getElementById('mute-btn');
    this._muteBtn = btn;
    this._syncMuteButton();
    if (btn) btn.addEventListener('click', () => this.toggleMute());
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') this.toggleMute(); });
  }

  _syncMuteButton() {
    if (this._muteBtn) {
      this._muteBtn.textContent = this.muted ? '🔇' : '🔊';
      this._muteBtn.setAttribute('aria-label', this.muted ? 'Unmute' : 'Mute');
    }
  }

  // --- Per-frame (called from Game.update) -----------------------------------

  update() {
    if (!this._live()) return;
    this._updateMusicMode();
    this._updateEngine();
    this._updateWhine();
    this._updateCountdown();
    this._scheduleMusic();
  }

  /**
   * Music mode follows GameState directly (not a start event) so it's correct for
   * every entry path: PLAY calls startGame() without emitting GAME_START, the
   * "Continue Story" → restart() path emits no event either. Racing = gameplay
   * track; otherwise the menu track.
   */
  _updateMusicMode() {
    const mode = gameState.started ? 'gameplay' : 'menu';
    if (mode !== this._musicMode) this.setMusic(mode);
  }

  _updateEngine() {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    const racing = gameState.started && !gameState.finished && gameState.countdown <= 0;
    const spd = Math.min(1, Math.abs(gameState.speed) / KART.MAX_SPEED);
    const idle = gameState.started && !gameState.finished; // engine "on" during countdown too
    const freq = idle ? 50 + spd * 165 : 42;
    const cutoff = idle ? 380 + spd * 1500 : 300;
    const vol = idle ? (racing ? 0.045 + spd * 0.06 : 0.03) : 0;
    e.osc.frequency.setTargetAtTime(freq, t, 0.07);
    e.filter.frequency.setTargetAtTime(cutoff, t, 0.1);
    e.gain.gain.setTargetAtTime(vol, t, 0.12);
  }

  _updateWhine() {
    const w = this.whine;
    if (!w) return;
    const t = this.ctx.currentTime;
    if (gameState.drifting) {
      const charge = Math.min(1, gameState.driftCharge / DRIFT.CHARGE_BIG);
      w.osc.frequency.setTargetAtTime(440 + charge * 540, t, 0.04);
      w.gain.gain.setTargetAtTime(0.012 + charge * 0.03, t, 0.04);
    } else {
      w.gain.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  _updateCountdown() {
    if (!gameState.started) { this._lastBeep = null; this._goPlayed = false; return; }
    const c = gameState.countdown;
    if (c > 0) {
      const n = Math.ceil(c);
      if (n !== this._lastBeep && n >= 1 && n <= 3) { this._lastBeep = n; this._beep(700, 0.13, 0.16); }
      this._goPlayed = false;
    } else if (!this._goPlayed) {
      this._goPlayed = true;
      this._lastBeep = null;
      this._chord([660, 880, 1320], 0.34, 0.16); // GO!
    }
  }

  // --- Music (lookahead step sequencer) --------------------------------------

  setMusic(mode) {
    this._musicMode = mode;
    if (this._live()) this._nextNoteTime = Math.max(this._nextNoteTime, this.ctx.currentTime + 0.05);
    this._step = 0;
  }

  duckMusic(on) {
    if (!this.musicGain || !this.ctx) return;
    this.musicGain.gain.setTargetAtTime(on ? this.MUSIC_BASE * 0.28 : this.MUSIC_BASE, this.ctx.currentTime, 0.2);
  }

  _scheduleMusic() {
    if (!this._musicMode) return;
    const ctx = this.ctx;
    const stepDur = this._musicMode === 'gameplay' ? 0.15 : 0.26; // tempo
    while (this._nextNoteTime < ctx.currentTime + 0.12) {
      this._playStep(this._musicMode, this._step, this._nextNoteTime, stepDur);
      this._nextNoteTime += stepDur;
      this._step = (this._step + 1) % 16;
    }
  }

  _playStep(mode, step, when, stepDur) {
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    // Lead = major pentatonic over C; bass walks the chord roots.
    const LEAD = mode === 'gameplay'
      ? [72, 76, 79, 76, 81, 79, 76, 79, 74, 76, 79, 81, 79, 76, 74, 72]
      : [72, null, 76, null, 79, null, 76, null, 74, null, 77, null, 76, null, 72, null];
    const BASS = [48, 43, 45, 43]; // C3 G2 A2 G2 on each downbeat

    if (step % 4 === 0) {
      this._note(mtof(BASS[(step / 4) % 4]), when, mode === 'gameplay' ? 0.26 : 0.4, 'triangle', 0.16, this.musicGain);
    }
    const lead = LEAD[step];
    if (lead != null) {
      const dur = mode === 'gameplay' ? 0.14 : 0.22;
      this._note(mtof(lead), when, dur, 'square', mode === 'gameplay' ? 0.05 : 0.045, this.musicGain);
    }
  }

  // --- Discrete SFX ----------------------------------------------------------

  _subscribe() {
    // Music mode is driven from GameState in _updateMusicMode (works for every
    // start path). Cutscenes just duck the bed.
    eventBus.on(Events.CUTSCENE_START, () => this.duckMusic(true));
    eventBus.on(Events.CUTSCENE_END, () => this.duckMusic(false));

    eventBus.on(Events.ITEM_PICKUP, (d) => { if (d && d.isPlayer) this._sfxPickup(); });
    eventBus.on(Events.ITEM_USED, (d) => {
      if (!d || !d.isPlayer) return;
      if (d.type === 'shell') this._sfxThrow();
      else if (d.type === 'mud') this._sfxSplat();
      // melon boost is voiced by the BOOST event
    });
    eventBus.on(Events.ITEM_HIT, (d) => {
      if (!d || !d.isPlayer) return;
      if (d.type === 'pad') return; // pad boost is voiced by the BOOST event
      this._sfxHit();
    });
    eventBus.on(Events.BOOST, (d) => { if (d && d.isPlayer) this._sfxBoost(); });
    eventBus.on(Events.LAP_COMPLETED, () => this._sfxLap());
    eventBus.on(Events.RACE_FINISHED, (d) => this._sfxFinish(d && d.place === 1));
    eventBus.on(Events.NEAR_MISS, (d) => this._sfxNearMiss(d ? d.combo : 1));
    eventBus.on(Events.COMBO_RESET, () => this._sfxComboReset());
  }

  _sfxPickup() { this._note(880, this._t(), 0.09, 'square', 0.12, this.sfxGain); this._note(1320, this._t() + 0.09, 0.12, 'square', 0.12, this.sfxGain); }
  _sfxThrow()  { this._noise(0.22, this._t(), 0.18, 'bandpass', 1400, 400); this._note(520, this._t(), 0.16, 'sawtooth', 0.08, this.sfxGain); }
  _sfxSplat()  { this._noise(0.28, this._t(), 0.2, 'lowpass', 600, 120); }
  _sfxHit()    { this._noise(0.3, this._t(), 0.26, 'bandpass', 900, 200); this._note(150, this._t(), 0.26, 'square', 0.16, this.sfxGain); }
  _sfxBoost()  { this._noise(0.4, this._t(), 0.22, 'bandpass', 500, 2600); this._note(330, this._t(), 0.3, 'sawtooth', 0.07, this.sfxGain); }
  _sfxLap()    { this._note(784, this._t(), 0.12, 'square', 0.12, this.sfxGain); this._note(1175, this._t() + 0.1, 0.18, 'square', 0.12, this.sfxGain); }
  _sfxNearMiss(combo) { this._note(700 + Math.min(combo || 1, 14) * 70, this._t(), 0.07, 'square', 0.08, this.sfxGain); }
  _sfxComboReset() { const t = this._t(); this._note(320, t, 0.16, 'sawtooth', 0.11, this.sfxGain); this._note(190, t + 0.09, 0.22, 'sawtooth', 0.1, this.sfxGain); }

  _sfxFinish(won) {
    if (!this._live()) return;
    const t0 = this._t();
    const seq = won ? [72, 76, 79, 84] : [72, 71, 69];
    seq.forEach((m, i) => {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      this._note(f, t0 + i * 0.16, 0.3, 'square', 0.12, this.sfxGain);
      if (won) this._note(f / 2, t0 + i * 0.16, 0.3, 'triangle', 0.08, this.sfxGain);
    });
  }

  _beep(freq, dur, peak) { this._note(freq, this._t(), dur, 'square', peak, this.sfxGain); }
  _chord(freqs, dur, peak) { const t = this._t(); freqs.forEach((f) => this._note(f, t, dur, 'square', peak * 0.7, this.sfxGain)); }

  // --- Primitives ------------------------------------------------------------

  _t() { return this.ctx ? this.ctx.currentTime : 0; }

  _note(freq, when, dur, type, peak, dest) {
    if (!this._live()) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(when); o.stop(when + dur + 0.03);
  }

  _noise(dur, when, peak, filterType, f0, f1) {
    if (!this._live() || !this._noiseBuf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(f0, when);
    if (f1) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur);
    flt.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    src.connect(flt); flt.connect(g); g.connect(this.sfxGain);
    src.start(when); src.stop(when + dur + 0.03);
  }
}
