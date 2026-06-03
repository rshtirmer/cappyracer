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
    this.wobblePhase = Math.random() * Math.PI * 2; // desync each rival's weave
  }

  computeInput(kart, track, obstacles) {
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

    // Twitchy: a bit of over-correction + a subtle weave so they look loose
    // (the frantic-sprinter energy the calm capybara lacks).
    this.wobblePhase += AI.WOBBLE_RATE;
    let steer = -diff * AI.STEER_GAIN + Math.sin(this.wobblePhase) * AI.WOBBLE;

    // Swerve around track props in front so they don't pile up on the same one.
    if (obstacles) steer += this.avoidObstacles(kart, obstacles);

    this.input.moveX = Math.max(-1, Math.min(1, steer));
    // Lift a little in corners -> they carry too much speed in and occasionally run wide.
    const throttle = 1 - AI.CORNER_LIFT * Math.min(1, Math.abs(diff));
    this.input.moveZ = -throttle; // negative moveZ = accelerate
    return this.input;
  }

  /** Steering nudge to dodge any non-toppled obstacle in front of this kart. */
  avoidObstacles(kart, obstacles) {
    const fx = -Math.sin(kart.heading), fz = -Math.cos(kart.heading);
    let push = 0;
    for (const ob of obstacles) {
      if (ob.toppled) continue;
      const dx = ob.x - kart.mesh.position.x;
      const dz = ob.z - kart.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > AI.AVOID_RANGE || dist < 0.1) continue;
      if ((dx * fx + dz * fz) / dist < 0.5) continue;       // only dodge what's ahead
      const lateral = -dx * fz + dz * fx;                   // >0 = prop is to the right
      const strength = AI.AVOID_GAIN * (1 - dist / AI.AVOID_RANGE);
      push += (lateral > 0 ? -1 : 1) * strength;            // steer away from it
    }
    return push;
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
