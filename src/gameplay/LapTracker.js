import { TRACK } from '../core/Constants.js';

/**
 * Counts laps using ordered checkpoint gates so a lap can't be faked by
 * reversing back and forth over the start line. Gates are evenly spaced
 * progress values [0, 1/G, 2/G, ...]. The kart spawns at gate 0; it must then
 * cross gates 1, 2, ... G-1 in order and finally re-cross the start (gate 0)
 * going forward to complete a lap.
 */
export class LapTracker {
  constructor(gateCount = TRACK.GATES) {
    this.gateCount = gateCount;
    this.gates = [];
    for (let i = 0; i < gateCount; i++) this.gates.push(i / gateCount);
    this.reset();
  }

  reset() {
    this.lap = 0;
    this.nextGate = 1;   // next ordered gate index we expect to cross
    this.prev = null;    // previous progress (null until first update)
  }

  /**
   * Was gate value `g` crossed going forward between progress `prev` and `cur`?
   * Direction is resolved by the shorter arc: a step whose forward distance is
   * > half the loop is treated as a backward move (so wiggling across the start
   * line can't fake progress).
   */
  static crossedForward(prev, cur, g) {
    const fwd = ((cur - prev) % 1 + 1) % 1; // forward distance prev -> cur
    if (fwd === 0 || fwd > 0.5) return false; // not a genuine short forward step
    const gd = ((g - prev) % 1 + 1) % 1;      // forward distance prev -> gate
    return gd > 0 && gd <= fwd;
  }

  /**
   * Feed the current loop progress (0..1). Returns the number of laps
   * completed on this update (0 or 1).
   */
  update(progress) {
    if (this.prev === null) { this.prev = progress; return 0; }

    let completed = 0;
    const g = this.gates[this.nextGate];
    if (LapTracker.crossedForward(this.prev, progress, g)) {
      if (this.nextGate === 0) {
        this.lap += 1;
        completed = 1;
        this.nextGate = 1;
      } else {
        this.nextGate = (this.nextGate + 1) % this.gateCount;
      }
    }
    this.prev = progress;
    return completed;
  }
}
