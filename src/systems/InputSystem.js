// =============================================================================
// InputSystem.js — Unified analog input (keyboard + mobile)
//
// Provides moveX / moveZ (-1..1) from whichever source is active.
// Game logic reads only moveX/moveZ and never knows the input source.
//
// Extension points for mobile:
// - GyroscopeInput: import and call requestPermission() from a user gesture,
//   read moveX/moveZ from DeviceOrientationEvent with deadzone + smoothing.
// - VirtualJoystick: DOM-based circle-in-circle touch joystick, outputs
//   moveX/moveZ from touch drag displacement.
//
// Priority: Keyboard always overrides. On mobile, gyro is tried first; if
// unavailable, virtual joystick is shown as fallback.
// =============================================================================

import { gameState } from '../core/GameState.js';
import { MobileControls, isTouchDevice } from '../ui/MobileControls.js';

export class InputSystem {
  constructor() {
    this.keys = {};

    // Analog output (-1..1) consumed by gameplay code
    this.moveX = 0;
    this.moveZ = 0;

    // Mobile detection
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1);

    this.useQueued = false; // edge-triggered "use item" (Space / E)
    this.controls = null;   // on-screen touch controls (mobile / ?touch=1)

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'KeyE') { this.useQueued = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Build touch controls on touch devices (or forced via ?touch=1 for testing).
    const force = new URLSearchParams(location.search).get('touch') === '1';
    if (isTouchDevice() || force) this.initMobile();
  }

  /** Returns true once per "use item" press, then clears it. */
  consumeUse() {
    const q = this.useQueued;
    this.useQueued = false;
    return q;
  }

  isDown(code) {
    return !!this.keys[code];
  }

  /** Build the on-screen touch controls (left analog stick + DRIFT/ITEM buttons). */
  initMobile() {
    this.controls = new MobileControls();
  }

  /**
   * Call once per frame in the game loop.
   * Merges keyboard + touch sources into moveX/moveZ (keyboard overrides).
   */
  update() {
    let mx = 0;
    let mz = 0;

    // Keyboard (always active, acts as override)
    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) mx -= 1;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) mx += 1;
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) mz -= 1;
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) mz += 1;

    // Touch controls: visible only while racing; feed steering/throttle + item.
    if (this.controls) {
      this.controls.setVisible(gameState.started && !gameState.finished);
      if (this.controls.consumeUse()) this.useQueued = true;
      if (mx === 0 && mz === 0) {
        const v = this.controls.getVector();
        mx = v.x;
        mz = -v.y; // stick up (+y) => forward (moveZ -1)
      }
    }

    this.moveX = Math.max(-1, Math.min(1, mx));
    this.moveZ = Math.max(-1, Math.min(1, mz));
  }

  // Legacy boolean getters for backward compatibility
  get left() { return this.isDown('ArrowLeft') || this.isDown('KeyA'); }
  get right() { return this.isDown('ArrowRight') || this.isDown('KeyD'); }
  get forward() { return this.isDown('ArrowUp') || this.isDown('KeyW'); }
  get backward() { return this.isDown('ArrowDown') || this.isDown('KeyS'); }
  get jump() { return this.isDown('Space'); }
  get drift() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this.isDown('KeyZ')
      || (this.controls ? this.controls.driftHeld : false);
  }
}
