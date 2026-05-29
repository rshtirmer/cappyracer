import * as THREE from 'three';
import { TRAFFIC } from '../core/Constants.js';

/**
 * Highway traffic for the "no-hesi" bonus track: a stream of slower vehicles
 * circulating the loop in fixed lanes that the player must weave through.
 * Rear-ending one spins you out and bleeds your speed — the whole point is to
 * keep flowing without hesitating (or crashing).
 *
 * Only the player collides with traffic; AI rivals pass through (they follow
 * the racing line and would otherwise pile up endlessly).
 */
export class Traffic {
  constructor(scene, track) {
    this.track = track;
    this.length = track.curve.getLength() || 1;
    this.cars = [];

    // Seeded so layout/speeds are stable across reloads (no Math.random).
    const seed = (n) => ((Math.sin(n * 91.17) * 4123.77) % 1 + 1) % 1;

    const n = TRAFFIC.COUNT;
    const body = new THREE.BoxGeometry(TRAFFIC.CAR_W, TRAFFIC.CAR_H, TRAFFIC.CAR_L);
    body.translate(0, TRAFFIC.CAR_H / 2 + 0.25, 0);
    const bodyMat = new THREE.MeshLambertMaterial({ flatShading: true });
    this.bodyMesh = new THREE.InstancedMesh(body, bodyMat, n);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

    const cabin = new THREE.BoxGeometry(TRAFFIC.CAR_W * 0.86, TRAFFIC.CAR_H * 0.72, TRAFFIC.CAR_L * 0.46);
    cabin.translate(0, TRAFFIC.CAR_H + 0.18, -TRAFFIC.CAR_L * 0.08);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x12161f, flatShading: true });
    this.cabinMesh = new THREE.InstancedMesh(cabin, cabinMat, n);
    this.cabinMesh.castShadow = true;

    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.cars.push({
        progress: (0.08 + (i / n) * 0.84) % 1,            // spread; clear of the grid
        lane: TRAFFIC.LANES[i % TRAFFIC.LANES.length],
        speed: TRAFFIC.MIN_SPEED + seed(i + 3) * (TRAFFIC.MAX_SPEED - TRAFFIC.MIN_SPEED),
        hitTimer: 0,
      });
      color.set(TRAFFIC.COLORS[i % TRAFFIC.COLORS.length]);
      this.bodyMesh.setColorAt(i, color);
    }
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;

    scene.add(this.bodyMesh);
    scene.add(this.cabinMesh);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this.syncMatrices();
  }

  /** Recompute and upload every car's transform from its current progress. */
  syncMatrices() {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const s = this.track.pointAt(car.progress);
      this._p.set(
        s.pos.x + s.normal.x * car.lane,
        0,
        s.pos.z + s.normal.z * car.lane
      );
      this._e.set(0, Math.atan2(s.tan.x, s.tan.z), 0);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p, this._q, this._s);
      this.bodyMesh.setMatrixAt(i, this._m);
      this.cabinMesh.setMatrixAt(i, this._m);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.cabinMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Advance traffic and (when racing) collide it with the player.
   * @param racing - true once the countdown is over (apply collisions only then)
   */
  update(delta, racers, racing) {
    const dp = delta / this.length;
    for (const car of this.cars) {
      car.progress = (car.progress + car.speed * dp) % 1;
      if (car.hitTimer > 0) car.hitTimer -= delta;
    }
    this.syncMatrices();

    if (!racing || !racers || !racers.length) return;
    const player = racers[0];
    const kart = player.kart;
    if (kart.spinTimer > 0) return;
    const px = kart.mesh.position.x;
    const pz = kart.mesh.position.z;
    const r2 = TRAFFIC.HIT_DIST * TRAFFIC.HIT_DIST;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.hitTimer > 0) continue;
      const s = this.track.pointAt(car.progress);
      const cx = s.pos.x + s.normal.x * car.lane;
      const cz = s.pos.z + s.normal.z * car.lane;
      const dx = px - cx;
      const dz = pz - cz;
      if (dx * dx + dz * dz < r2) {
        kart.spinOut(TRAFFIC.SPIN_TIME);
        kart.speed *= TRAFFIC.SPEED_KEEP;
        car.hitTimer = TRAFFIC.HIT_COOLDOWN;
        break; // one clip per frame
      }
    }
  }
}
