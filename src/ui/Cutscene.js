import { eventBus, Events } from '../core/EventBus.js';

/** Per-shot camera framing. `speed` = orbit rad/s; radius/height ease over PUSH. */
const SHOTS = {
  rise:  { r0: 6.5, r1: 13.0, h0: 1.8, h1: 6.6, speed: 0.16 },
  orbit: { r0: 9.0, r1: 10.5, h0: 4.0, h1: 4.6, speed: 0.30 },
  flyby: { r0: 15.0, r1: 8.5, h0: 3.4, h1: 3.0, speed: 0.5 },
};
const PUSH = 4.0;          // seconds over which radius/height settle
const CPS = 48;            // typewriter characters per second
const FOV = 50;            // cinematic field of view

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * In-engine cinematics: takes over the camera for a scripted move around a
 * focus point in the live 3D world, with a letterboxed dialogue overlay that
 * types out each line. Click / Enter advances; Skip ends it. Generic over story
 * beats — Game decides which beat to play and what happens when it ends.
 */
export class Cutscene {
  constructor(camera, getFocus) {
    this.camera = camera;
    this.getFocus = getFocus;
    this.playing = false;
    this.beat = null;
    this.onDone = null;
    this.lineIndex = 0;
    this.lineChars = 0;     // revealed characters of the current line
    this.shotT = 0;
    this.startAngle = 0;

    // DOM
    this.overlay = document.getElementById('cutscene-overlay');
    this.speakerEl = document.getElementById('cutscene-speaker');
    this.textEl = document.getElementById('cutscene-text');
    this.hintEl = document.getElementById('cutscene-hint');
    this.skipBtn = document.getElementById('cutscene-skip');

    if (this.overlay) this.overlay.addEventListener('click', (e) => {
      if (e.target === this.skipBtn) return;
      this.advance();
    });
    if (this.skipBtn) this.skipBtn.addEventListener('click', (e) => { e.stopPropagation(); this.skip(); });
    window.addEventListener('keydown', (e) => {
      if (!this.playing) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.advance(); }
      else if (e.code === 'Escape') { e.preventDefault(); this.skip(); }
    });
  }

  get currentLine() {
    return this.beat && this.beat.lines[this.lineIndex];
  }

  /** Begin a beat. `onDone` runs once the last line is dismissed (or skipped). */
  play(beat, onDone) {
    if (!beat || !beat.lines || !beat.lines.length) { onDone && onDone(); return; }
    this.beat = beat;
    this.onDone = onDone || null;
    this.lineIndex = 0;
    this.lineChars = 0;
    this.shotT = 0;
    this.playing = true;

    // Ease the orbit from wherever the camera currently sits behind the focus.
    const f = this.getFocus();
    this.startAngle = Math.atan2(this.camera.position.x - f.x, this.camera.position.z - f.z);
    this.camera.fov = FOV;
    this.camera.updateProjectionMatrix();

    if (this.overlay) {
      this.overlay.classList.add('show');
      this.overlay.classList.toggle('finale', !!beat.final);
    }
    this.renderLine();
    eventBus.emit(Events.CUTSCENE_START, beat.id);
  }

  /** Click / Enter: finish the typewriter, else advance to the next line / end. */
  advance() {
    if (!this.playing) return;
    const line = this.currentLine;
    if (!line) { this.end(); return; }
    if (this.lineChars < line.text.length) {
      this.lineChars = line.text.length; // reveal the rest instantly
      this.renderLine();
      return;
    }
    if (this.lineIndex >= this.beat.lines.length - 1) { this.end(); return; }
    this.lineIndex++;
    this.lineChars = 0;
    this.renderLine();
  }

  skip() { if (this.playing) this.end(); }

  end() {
    this.playing = false;
    const beat = this.beat;
    const done = this.onDone;
    this.beat = null;
    this.onDone = null;
    if (this.overlay) this.overlay.classList.remove('show', 'finale');
    eventBus.emit(Events.CUTSCENE_END, beat ? beat.id : null);
    if (done) done();
  }

  renderLine() {
    const line = this.currentLine;
    if (!line || !this.textEl) return;
    if (this.speakerEl) this.speakerEl.textContent = line.who || '';
    this.textEl.textContent = line.text.slice(0, Math.floor(this.lineChars));
    const last = this.lineIndex >= this.beat.lines.length - 1;
    const full = this.lineChars >= line.text.length;
    if (this.hintEl) this.hintEl.textContent = full
      ? (last ? '▶ click / Enter to begin' : '▶ click / Enter')
      : '';
  }

  /** Drive the camera move + typewriter. Called by Game while `playing`. */
  update(delta) {
    if (!this.playing) return;

    // Typewriter reveal.
    const line = this.currentLine;
    if (line && this.lineChars < line.text.length) {
      this.lineChars = Math.min(line.text.length, this.lineChars + CPS * delta);
      this.renderLine();
    }

    // Camera: a slow orbit whose radius/height eases in over PUSH seconds.
    this.shotT += delta;
    const shot = SHOTS[this.beat.shot] || SHOTS.orbit;
    const k = easeOutCubic(Math.min(1, this.shotT / PUSH));
    const radius = shot.r0 + (shot.r1 - shot.r0) * k;
    const height = shot.h0 + (shot.h1 - shot.h0) * k;
    const angle = this.startAngle + this.shotT * shot.speed;
    const f = this.getFocus();
    this.camera.position.set(
      f.x + Math.sin(angle) * radius,
      f.y + height,
      f.z + Math.cos(angle) * radius
    );
    this.camera.lookAt(f.x, f.y + 1.25, f.z);
  }
}
