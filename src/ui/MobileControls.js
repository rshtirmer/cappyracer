/**
 * MobileControls — dependency-free touch controls for CappyRacer.
 *
 * A compact vanilla-JS port of the gamecn `mobile-joystick` catalog component
 * (https://gamecn.dev/catalog/mobile-joystick), adapted to this project's
 * zero-dependency, vanilla-ESM style instead of running the shadcn-style
 * `npx gamecn add` CLI (which expects a gamecn.json / TS / alias setup).
 *
 * Layout (kart-racer scheme):
 *   - LEFT  : analog thumbstick — x steers, y throttles (push up = gas, down = brake/reverse)
 *   - RIGHT : DRIFT (hold) + ITEM (tap) buttons
 *
 * Uses Pointer Events with per-element pointer capture, so multi-touch works
 * (steer + drift + item simultaneously) and it's drivable with a mouse on
 * desktop for testing (?touch=1).
 *
 * The InputSystem reads getVector()/driftHeld/consumeUse(); game logic still
 * only ever sees moveX/moveZ (the input-source abstraction is preserved).
 */

export function isTouchDevice() {
  return (
    typeof window !== 'undefined' &&
    (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0)
  );
}

/** Full-screen host overlay; transparent + click-through except on the controls. */
function makeOverlay() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', inset: '0', zIndex: '25',
    pointerEvents: 'none', touchAction: 'none', userSelect: 'none',
    display: 'none',
  });
  el.className = 'mobile-controls';
  return el;
}

/** Static-base analog thumbstick. getVector() -> {x,y} in [-1,1] (up = +y). */
class MobileJoystick {
  constructor({ parent, side = 'left', radius = 64, deadzone = 0.12 }) {
    this.radius = radius;
    this.deadzone = deadzone;
    this.x = 0; this.y = 0;
    this.active = false;
    this.pointerId = null;
    this.cx = 0; this.cy = 0; // current base center (set on grab in dynamic zone)

    // A large invisible grab zone on one half of the screen.
    const zone = document.createElement('div');
    Object.assign(zone.style, {
      position: 'absolute', bottom: '0', top: '0', width: '46%',
      [side]: '0', pointerEvents: 'auto', touchAction: 'none',
    });

    // Visible base ring + knob (anchored, dynamic position follows first touch).
    const base = document.createElement('div');
    Object.assign(base.style, {
      position: 'absolute', width: `${radius * 2}px`, height: `${radius * 2}px`,
      borderRadius: '50%', border: '2px solid rgba(255,255,255,0.30)',
      background: 'rgba(255,255,255,0.07)', transform: 'translate(-50%,-50%)',
      left: '120px', bottom: '120px', pointerEvents: 'none', opacity: '0.55',
      boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
    });
    const knob = document.createElement('div');
    Object.assign(knob.style, {
      position: 'absolute', width: `${radius}px`, height: `${radius}px`,
      borderRadius: '50%', background: 'rgba(255,255,255,0.55)',
      border: '2px solid rgba(255,255,255,0.7)', transform: 'translate(-50%,-50%)',
      left: '50%', top: '50%', pointerEvents: 'none',
    });
    base.appendChild(knob);
    zone.appendChild(base);
    parent.appendChild(zone);
    this.zone = zone; this.base = base; this.knob = knob;
    this._baseDefault = { left: 120, bottom: 120 };

    zone.addEventListener('pointerdown', (e) => this._down(e));
    zone.addEventListener('pointermove', (e) => this._move(e));
    zone.addEventListener('pointerup', (e) => this._up(e));
    zone.addEventListener('pointercancel', (e) => this._up(e));
  }

  _down(e) {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.active = true;
    this.zone.setPointerCapture(e.pointerId);
    // Dynamic base: place it where the thumb landed.
    this.cx = e.clientX; this.cy = e.clientY;
    this.base.style.left = `${this.cx}px`;
    this.base.style.bottom = 'auto';
    this.base.style.top = `${this.cy}px`;
    this.base.style.opacity = '0.85';
    this._move(e);
    e.preventDefault();
  }

  _move(e) {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.cx;
    let dy = e.clientY - this.cy;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, this.radius);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    this.knob.style.left = `calc(50% + ${dx}px)`;
    this.knob.style.top = `calc(50% + ${dy}px)`;
    let nx = dx / this.radius;
    let ny = -dy / this.radius; // screen-down is +dy; flip so push-up = +y
    const mag = Math.hypot(nx, ny);
    if (mag < this.deadzone) { nx = 0; ny = 0; }
    this.x = nx; this.y = ny;
    e.preventDefault();
  }

  _up(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.active = false;
    this.x = 0; this.y = 0;
    this.knob.style.left = '50%';
    this.knob.style.top = '50%';
    // Return base to its resting spot.
    this.base.style.left = `${this._baseDefault.left}px`;
    this.base.style.top = 'auto';
    this.base.style.bottom = `${this._baseDefault.bottom}px`;
    this.base.style.opacity = '0.55';
  }

  getVector() { return { x: this.x, y: this.y }; }
  isActive() { return this.active; }
}

/** A round touch button. mode 'hold' tracks pressed state; 'tap' fires onTap. */
class TouchButton {
  constructor({ parent, label, color, side = 'right', offsetX = 36, offsetY = 40, size = 84, mode = 'hold', onTap }) {
    this.pressed = false;
    this.mode = mode;
    this.onTap = onTap;
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute', width: `${size}px`, height: `${size}px`,
      [side]: `${offsetX}px`, bottom: `${offsetY}px`,
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '700 16px Quicksand, system-ui, sans-serif', color: '#fff',
      letterSpacing: '0.5px', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
      background: color || 'rgba(255,255,255,0.18)',
      border: '2px solid rgba(255,255,255,0.4)', pointerEvents: 'auto', touchAction: 'none',
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)', transition: 'transform .06s, background .06s',
    });
    el.textContent = label;
    el.addEventListener('pointerdown', (e) => {
      this.pressed = true;
      el.style.transform = 'scale(0.92)';
      el.style.background = 'rgba(255,255,255,0.5)';
      if (this.mode === 'tap' && this.onTap) this.onTap();
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation();
    });
    const release = (e) => {
      this.pressed = false;
      el.style.transform = 'scale(1)';
      el.style.background = color || 'rgba(255,255,255,0.18)';
      if (e) e.preventDefault();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    parent.appendChild(el);
    this.el = el;
  }
}

/** Assembles the joystick + buttons and exposes a small read API for InputSystem. */
export class MobileControls {
  constructor() {
    this.overlay = makeOverlay();
    document.body.appendChild(this.overlay);
    this.joystick = new MobileJoystick({ parent: this.overlay, side: 'left', radius: 62, deadzone: 0.14 });
    this.driftBtn = new TouchButton({
      parent: this.overlay, label: 'DRIFT', color: 'rgba(80,150,230,0.40)',
      side: 'right', offsetX: 132, offsetY: 44, size: 92, mode: 'hold',
    });
    this.itemBtn = new TouchButton({
      parent: this.overlay, label: 'ITEM', color: 'rgba(245,200,70,0.42)',
      side: 'right', offsetX: 40, offsetY: 96, size: 84, mode: 'tap',
      onTap: () => { this._useQueued = true; },
    });
    this._useQueued = false;
    this.visible = false;
  }

  getVector() { return this.joystick.getVector(); }
  get driftHeld() { return this.driftBtn.pressed; }
  consumeUse() { const q = this._useQueued; this._useQueued = false; return q; }

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    this.overlay.style.display = v ? 'block' : 'none';
  }
}
