import { AI, KART } from '../core/Constants.js';

/**
 * Simple racing-line AI. Each frame it locates the kart on the track, aims at a
 * look-ahead point on its preferred lane, and produces synthetic kart input
 * ({moveX, moveZ}) to steer there — easing the throttle when it has to turn
 * hard. A per-rival skill factor caps top speed so the field is competitive.
 */
export class AIController {
  constructor(lane, skill) {
    this.lane = lane;
    this.skill = skill;
    this.input = { moveX: 0, moveZ: 0 };
  }

  computeInput(kart, track) {
    const loc = track.locate(kart.mesh.position);
    const n = track.samples.length;
    const ahead = track.samples[(loc.index + AI.LOOKAHEAD) % n];

    // Aim point: look-ahead centerline sample offset onto this rival's lane.
    const tx = ahead.pos.x + ahead.normal.x * this.lane;
    const tz = ahead.pos.z + ahead.normal.z * this.lane;
    const dx = tx - kart.mesh.position.x;
    const dz = tz - kart.mesh.position.z;

    // Heading that points the kart's forward (-sin h, -cos h) at the target.
    const desired = Math.atan2(-dx, -dz);
    let diff = desired - kart.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-pi, pi]

    this.input.moveX = Math.max(-1, Math.min(1, -diff * AI.STEER_GAIN));
    const throttle = 1 - 0.5 * Math.min(1, Math.abs(diff)); // ease off in corners
    this.input.moveZ = -throttle; // negative moveZ = accelerate
    return this.input;
  }

  /**
   * Cap top speed to this rival's skill so the player can race them. `rubber` is
   * a rubber-band scale (>1 when this AI is behind the player, <1 when ahead) so
   * the pack stays close.
   */
  capSpeed(kart, rubber = 1) {
    const boost = kart.boostTimer > 0 ? kart.boostMult : 1;
    const max = KART.MAX_SPEED * this.skill * kart.surfaceGrip * boost * rubber;
    if (kart.speed > max) kart.speed = max;
  }
}
