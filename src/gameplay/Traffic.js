import * as THREE from 'three';
import { TRAFFIC } from '../core/Constants.js';
import { disposeObject3D } from '../core/disposeUtils.js';

/**
 * Highway traffic for the "no-hesi" bonus track: a heavy, multi-lane stream of
 * slower vehicles circulating the loop that the player must weave through.
 * Rear-ending one spins you out and bleeds speed — keep flowing without
 * hesitating (or crashing). Only the player collides; AI rivals pass through.
 *
 * Cars render as real low-poly GLB models, instanced for cheap heavy traffic:
 * the sedan's body material ("Main") is tinted per-car from a realistic palette
 * (via instanceColor) while glass/wheels keep their native dark materials; a
 * second hatchback shape adds silhouette variety. If no car GLB loaded, falls
 * back to primitive boxes. All meshes are flagged `noPS2` so they DON'T get the
 * world's vertex-snap wobble — that snap is what made the old boxes visibly
 * shake as you drove past (the karts live outside the snapped worldGroup).
 */
export class Traffic {
  constructor(scene, track, carGltfs) {
    this.scene = scene;
    this.track = track;
    this.length = track.curve.getLength() || 1;
    this.cars = [];
    this.allMeshes = [];

    // Seeded so layout/speeds/colors are stable across reloads (no Math.random).
    const seed = (n) => ((Math.sin(n * 91.17) * 4123.77) % 1 + 1) % 1;

    const n = TRAFFIC.COUNT;
    for (let i = 0; i < n; i++) {
      // Even base spread (clear of the grid) + per-car jitter, with a randomized
      // lane, so traffic scatters realistically instead of forming neat rows.
      const base = 0.05 + (i / n) * 0.9;
      this.cars.push({
        progress: (base + (seed(i + 11) - 0.5) * 0.5 / n + 1) % 1,
        lane: TRAFFIC.LANES[Math.floor(seed(i + 5) * TRAFFIC.LANES.length)],
        speed: TRAFFIC.MIN_SPEED + seed(i + 3) * (TRAFFIC.MAX_SPEED - TRAFFIC.MIN_SPEED),
        hitTimer: 0,
        model: 0, slot: 0,
        colorIdx: Math.floor(seed(i + 7) * TRAFFIC.BODY_COLORS.length),
      });
    }

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);

    const valid = (carGltfs || []).filter(Boolean);
    this.boxMode = valid.length === 0;
    if (this.boxMode) this._buildBoxFleet(n);
    else this._buildModelFleet(valid);

    this.syncMatrices();
  }

  // --- GLB car fleet ---------------------------------------------------------

  /**
   * Bake every mesh of a car GLB into an instanceable part: geometry cloned into
   * model space, normalized so the longest footprint = MODEL_LENGTH with wheels
   * on y=0 and centered in x/z. `tintable` flags the body paint material so it
   * can be recolored per-car.
   */
  _bakeCar(gltf) {
    gltf.scene.updateMatrixWorld(true);
    const whole = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3(); whole.getSize(size);
    const s = TRAFFIC.MODEL_LENGTH / (Math.max(size.x, size.z) || 1);
    const cx = (whole.min.x + whole.max.x) / 2;
    const cz = (whole.min.z + whole.max.z) / 2;
    const minY = whole.min.y;

    const parts = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      geo.translate(-cx, -minY, -cz);
      geo.scale(s, s, s);
      const name = (o.material && o.material.name) || '';
      const tintable = /(^|[^a-z])(main|body|paint|carpaint|chassis)([^a-z]|$)/i.test(name);
      parts.push({ geometry: geo, material: o.material, tintable });
    });
    return parts;
  }

  _buildModelFleet(gltfs) {
    this.models = gltfs.map((g) => this._bakeCar(g));
    const numModels = this.models.length;

    // Assign each car a model (round-robin) + a local slot within that model.
    const groups = this.models.map(() => []);
    for (let i = 0; i < this.cars.length; i++) {
      const mi = i % numModels;
      this.cars[i].model = mi;
      this.cars[i].slot = groups[mi].length;
      groups[mi].push(i);
    }

    // One InstancedMesh per (model, part). Tintable body parts get a cloned white
    // material + per-instance color; everything else keeps its native (shared)
    // material.
    this.partMeshes = this.models.map((parts, mi) => {
      const count = groups[mi].length || 1;
      return parts.map((part) => {
        let material;
        if (part.tintable) {
          material = part.material.clone();
          material.color = new THREE.Color(0xffffff); // white base -> instanceColor is the true color
        } else {
          material = part.material; // borrowed from the gltf
        }
        const im = new THREE.InstancedMesh(part.geometry, material, count);
        im.castShadow = true;
        im.userData.noPS2 = true;                 // <- no vertex-snap wobble
        if (!part.tintable) im.userData.sharedMaterial = true; // don't dispose the gltf's material
        return { im, tintable: part.tintable };
      });
    });

    // Tint each car's body from the palette.
    const col = new THREE.Color();
    for (const car of this.cars) {
      col.set(TRAFFIC.BODY_COLORS[car.colorIdx % TRAFFIC.BODY_COLORS.length]);
      for (const { im, tintable } of this.partMeshes[car.model]) {
        if (tintable) im.setColorAt(car.slot, col);
      }
    }

    for (const meshes of this.partMeshes) {
      for (const { im } of meshes) {
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        this.scene.add(im);
        this.allMeshes.push(im);
      }
    }
  }

  // --- Primitive box fallback (no car GLB) -----------------------------------

  _buildBoxFleet(n) {
    const body = new THREE.BoxGeometry(TRAFFIC.CAR_W, TRAFFIC.CAR_H, TRAFFIC.CAR_L);
    body.translate(0, TRAFFIC.CAR_H / 2 + 0.25, 0);
    const bodyMat = new THREE.MeshLambertMaterial({ flatShading: true });
    this.bodyMesh = new THREE.InstancedMesh(body, bodyMat, n);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData.noPS2 = true;
    this.bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

    const cabin = new THREE.BoxGeometry(TRAFFIC.CAR_W * 0.86, TRAFFIC.CAR_H * 0.72, TRAFFIC.CAR_L * 0.46);
    cabin.translate(0, TRAFFIC.CAR_H + 0.18, -TRAFFIC.CAR_L * 0.08);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x12161f, flatShading: true });
    this.cabinMesh = new THREE.InstancedMesh(cabin, cabinMat, n);
    this.cabinMesh.castShadow = true;
    this.cabinMesh.userData.noPS2 = true;

    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      color.set(TRAFFIC.COLORS[i % TRAFFIC.COLORS.length]);
      this.bodyMesh.setColorAt(i, color);
    }
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.bodyMesh);
    this.scene.add(this.cabinMesh);
    this.allMeshes.push(this.bodyMesh, this.cabinMesh);
  }

  // --- Per-frame -------------------------------------------------------------

  /** Recompute and upload every car's transform from its current progress. */
  syncMatrices() {
    const yawAdd = this.boxMode ? 0 : TRAFFIC.MODEL_YAW;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const s = this.track.pointAtSmooth(car.progress); // smooth, not sample-snapped (no stutter)
      this._p.set(s.pos.x + s.normal.x * car.lane, 0, s.pos.z + s.normal.z * car.lane);
      this._e.set(0, Math.atan2(s.tan.x, s.tan.z) + yawAdd, 0);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p, this._q, this._s);
      if (this.boxMode) {
        this.bodyMesh.setMatrixAt(i, this._m);
        this.cabinMesh.setMatrixAt(i, this._m);
      } else {
        for (const { im } of this.partMeshes[car.model]) im.setMatrixAt(car.slot, this._m);
      }
    }
    for (const im of this.allMeshes) im.instanceMatrix.needsUpdate = true;
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
      const s = this.track.pointAtSmooth(car.progress);
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

  /** Remove + free this traffic's meshes (for an in-place rebuild after load). */
  dispose() {
    for (const im of this.allMeshes) {
      if (im.parent) im.parent.remove(im);
      disposeObject3D(im);
    }
    this.allMeshes = [];
    this.partMeshes = null;
  }
}
