import * as THREE from 'three';
import { ENV, ENV_PRESETS, COLORS, OBSTACLES } from '../core/Constants.js';

/** Tiny seeded RNG so scenery layout is stable across reloads/screenshots. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bake ALL meshes of a GLB into geometries normalized so the whole model is
 * height 1, base at y=0, centered in x/z. A multi-primitive GLB (e.g. a tree =
 * trunk + foliage) loads as several meshes; InstancedMesh renders one
 * geometry+material each, so we return one baked part per mesh and instance
 * them in lockstep with shared transforms. Returns [{ geometry, material }].
 */
function bakeUnitParts(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const whole = new THREE.Box3().setFromObject(gltf.scene);
  const h = (whole.max.y - whole.min.y) || 1;
  const inv = 1 / h;
  const cx = (whole.min.x + whole.max.x) / 2;
  const cz = (whole.min.z + whole.max.z) / 2;
  const minY = whole.min.y;

  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld); // into model/world space
    geo.translate(-cx, -minY, -cz);  // base at origin, centered x/z
    geo.scale(inv, inv, inv);        // normalize to unit height
    parts.push({ geometry: geo, material: o.material });
  });
  return parts;
}

/**
 * Static environment dressing around the circuit, themed by `theme.env`:
 *   - springs : GLB trees + rocks + procedural hot-spring pools (with steam) + PSX props.
 *   - space   : floating GLB asteroids + glowing crystals (no trees/springs).
 *   - highway : roadside PSX clutter + sparse distant rocks (no trees/springs).
 * Positions derive from the track centerline so nothing lands on the road.
 */
export class Scenery {
  constructor(scene, track, models, theme) {
    this.scene = scene;
    this.track = track;
    this.models = models;
    this.theme = theme || {};
    this.env = this.theme.env || 'springs';
    this.rng = mulberry32(1337);
    this.hotSprings = []; // empty unless springs env -> emitSteam stays a no-op

    if (this.env === 'space') {
      this.buildAsteroids();
      this.buildCrystals();
    } else if (this.env === 'highway') {
      this.buildHighwaySides();
    } else {
      this.buildTrees();
      this.buildRocks();
      this.buildHotSprings();
      this.buildPSXProps();
      this.buildTrackObstacles();
    }
  }

  /**
   * Solid, smashable props placed ON the racing line (road shoulders). Collision
   * response + the boulder/rival rules live in Game; Scenery owns the props, the
   * topple animation, and reset. Each obstacle: { x, z, group, baseY, baseQuat,
   * toppled, t, axis }.
   */
  buildTrackObstacles() {
    this.obstacles = [];
    if (!this.track.pointAt) return;
    for (const def of OBSTACLES.SPRINGS) {
      const gltf = this.models[def.model];
      if (!gltf) continue;
      const s = this.track.pointAt(def.progress);
      let nx = s.tan.z, nz = -s.tan.x;               // lateral normal in XZ
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const x = s.pos.x + nx * def.offset;
      const z = s.pos.z + nz * def.offset;

      const group = new THREE.Group();
      for (const part of bakeUnitParts(gltf)) {       // unit-height baked parts
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.sharedMaterial = true;          // material borrowed from the gltf
        group.add(mesh);
      }
      group.scale.setScalar(def.scale ?? 1.6);
      group.position.set(x, 0, z);
      group.rotation.y = this.rng() * Math.PI * 2;
      this.scene.add(group);
      this.obstacles.push({ x, z, r: def.r ?? 0.7, group, baseY: 0, baseQuat: group.quaternion.clone(), toppled: false, t: 0, axis: null });
    }
  }

  /** Knock a smashed obstacle over in the impact direction (fx,fz). */
  topple(ob, fx, fz) {
    if (ob.toppled) return;
    ob.toppled = true; ob.t = 0;
    ob.axis = new THREE.Vector3(fz, 0, -fx);          // horizontal axis ⟂ to the fall
    if (ob.axis.lengthSq() < 1e-6) ob.axis.set(1, 0, 0);
    ob.axis.normalize();
    (this._toppling ||= []).push(ob);
  }

  /** Advance any in-progress topple animations (called each frame from Game). */
  update(delta) {
    if (!this._toppling || !this._toppling.length) return;
    const tq = new THREE.Quaternion();
    for (let i = this._toppling.length - 1; i >= 0; i--) {
      const ob = this._toppling[i];
      ob.t = Math.min(1, ob.t + delta / OBSTACLES.TOPPLE_TIME);
      const e = 1 - Math.pow(1 - ob.t, 3);            // ease-out
      tq.setFromAxisAngle(ob.axis, e * Math.PI * 0.48);
      ob.group.quaternion.copy(tq).multiply(ob.baseQuat);
      ob.group.position.y = ob.baseY - e * 0.12;
      if (ob.t >= 1) this._toppling.splice(i, 1);
    }
  }

  /** Stand every obstacle back up (called on race restart). */
  resetObstacles() {
    if (!this.obstacles) return;
    this._toppling = [];
    for (const ob of this.obstacles) {
      ob.toppled = false; ob.t = 0;
      ob.group.position.y = ob.baseY;
      ob.group.quaternion.copy(ob.baseQuat);
    }
  }

  /** Scatter PSX Mega Pack props (barrels, crates, barricades) near the track. */
  buildPSXProps() {
    const m = this.models;
    if (m.barrel) this.placeInstances(m.barrel, 22, 1.0, 1.35, 0.5, 14, false);
    if (m.crate) this.placeInstances(m.crate, 18, 0.6, 0.95, 0.5, 12, false);
    if (m.barricade) this.placeInstances(m.barricade, 16, 0.85, 1.0, 0.5, 5, false);
  }

  scatterPoint(minDist, maxDist) {
    const n = this.track.samples.length;
    const s = this.track.samples[Math.floor(this.rng() * n)];
    const side = this.rng() < 0.5 ? 1 : -1;
    const dist = this.track.wallHalf + minDist + this.rng() * (maxDist - minDist);
    return {
      x: s.pos.x + side * s.normal.x * dist,
      z: s.pos.z + side * s.normal.z * dist,
    };
  }

  buildTrees() {
    const half = Math.floor(ENV.TREE_COUNT / 2);
    this.placeInstances(this.models.tree1, half, ENV.TREE_MIN_H, ENV.TREE_MAX_H, 6, 75, false);
    this.placeInstances(this.models.tree2, ENV.TREE_COUNT - half, ENV.TREE_MIN_H, ENV.TREE_MAX_H, 6, 75, false);
  }

  buildRocks() {
    this.placeInstances(this.models.rock, ENV.ROCK_COUNT, ENV.ROCK_MIN_H, ENV.ROCK_MAX_H, 2, 62, true);
  }

  // --- Space env -------------------------------------------------------------

  /** Asteroids: rock GLBs scattered + lifted off the floor to float in the void. */
  buildAsteroids() {
    const p = ENV_PRESETS.space;
    if (this.models.rock) {
      this.placeInstances(this.models.rock, p.asteroidCount, 2.2, 6.5, 6, 90, true, 3, 30);
    }
    if (this.models.crate) {
      this.placeInstances(this.models.crate, 10, 1.0, 2.0, 8, 70, true, 2, 24); // debris
    }
  }

  /** Glowing low-poly crystals — neon accents that bloom against the dark. */
  buildCrystals() {
    const p = ENV_PRESETS.space;
    const palette = [0x4fe4ff, 0xb46cff, 0x4fffa0, 0xff6cc4];
    const geo = new THREE.OctahedronGeometry(1, 0);
    const meshes = palette.map((color) => {
      const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.9, flatShading: true,
        metalness: 0.1, roughness: 0.4,
      });
      const per = Math.ceil(p.crystalCount / palette.length);
      const im = new THREE.InstancedMesh(geo, mat, per);
      im.castShadow = true;
      im.userData.count = 0;
      return im;
    });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < p.crystalCount; i++) {
      const { x, z } = this.scatterPoint(5, 80);
      const h = 2.5 + this.rng() * 5;
      const y = this.rng() * 14;
      e.set(this.rng() * Math.PI, this.rng() * Math.PI * 2, this.rng() * Math.PI);
      q.setFromEuler(e);
      pos.set(x, y + h, z);
      scl.set(h * 0.5, h, h * 0.5);
      m.compose(pos, q, scl);
      const im = meshes[i % meshes.length];
      im.setMatrixAt(im.userData.count++, m);
    }
    for (const im of meshes) { im.instanceMatrix.needsUpdate = true; this.scene.add(im); }
  }

  // --- Highway env -----------------------------------------------------------

  /** Roadside clutter + distant rocks lining the highway verge. */
  buildHighwaySides() {
    const p = ENV_PRESETS.highway;
    const m = this.models;
    if (m.barricade) this.placeInstances(m.barricade, p.signCount, 0.9, 1.1, 0.8, 4, false);
    if (m.barrel) this.placeInstances(m.barrel, Math.floor(p.roadsidePropCount * 0.5), 1.0, 1.3, 1.5, 10, false);
    if (m.crate) this.placeInstances(m.crate, Math.floor(p.roadsidePropCount * 0.5), 0.6, 0.9, 1.5, 9, false);
    if (m.rock) this.placeInstances(m.rock, 12, 1.2, 3.2, 14, 90, true);
  }

  /**
   * Scatter `count` instances of a (possibly multi-part) GLB around the track.
   * `minY`/`maxY` lift instances off the floor (for floating space debris).
   */
  placeInstances(gltf, count, minH, maxH, minDist, maxDist, tilt, minY = 0, maxY = 0) {
    if (!gltf) return; // resilient: a model that failed to load just skips its dressing
    const parts = bakeUnitParts(gltf);
    const meshes = parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, count);
      im.castShadow = true;
      im.receiveShadow = true;
      // The instanced geometry is a fresh clone (disposable) but the material is
      // borrowed from the persistent model gltf — don't free it on world teardown.
      im.userData.sharedMaterial = true;
      return im;
    });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const { x, z } = this.scatterPoint(minDist, maxDist);
      const h = minH + this.rng() * (maxH - minH);
      const yaw = this.rng() * Math.PI * 2;
      e.set(tilt ? (this.rng() - 0.5) * 0.5 : 0, yaw, tilt ? (this.rng() - 0.5) * 0.5 : 0);
      q.setFromEuler(e);
      const y = minY + this.rng() * (maxY - minY);
      p.set(x, y, z);
      sc.set(h, h, h);
      m.compose(p, q, sc);
      for (const im of meshes) im.setMatrixAt(i, m);
    }
    for (const im of meshes) {
      im.instanceMatrix.needsUpdate = true;
      this.scene.add(im);
    }
  }

  buildHotSprings() {
    const waterMat = new THREE.MeshLambertMaterial({
      color: COLORS.WATER, emissive: COLORS.WATER, emissiveIntensity: 0.25,
    });
    const ringMat = new THREE.MeshLambertMaterial({ color: COLORS.WATER_RING, flatShading: true });
    const rocksPerSpring = 9;
    const rimRocks = [];

    for (let i = 0; i < ENV.HOTSPRING_COUNT; i++) {
      const { x, z } = this.scatterPoint(8, 45);
      const r = 3 + this.rng() * 2.5;

      const water = new THREE.Mesh(new THREE.CircleGeometry(r, 24), waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(x, 0.08, z);
      this.scene.add(water);

      for (let k = 0; k < rocksPerSpring; k++) {
        const a = (k / rocksPerSpring) * Math.PI * 2;
        rimRocks.push({
          x: x + Math.cos(a) * r,
          z: z + Math.sin(a) * r,
          scale: 0.5 + this.rng() * 0.4,
        });
      }
      this.hotSprings.push({ x, y: 0.4, z });
    }

    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mesh = new THREE.InstancedMesh(geo, ringMat, rimRocks.length);
    mesh.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    rimRocks.forEach((rk, idx) => {
      p.set(rk.x, 0.2, rk.z);
      s.set(rk.scale, rk.scale, rk.scale);
      m.compose(p, q, s);
      mesh.setMatrixAt(idx, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  /** Emit steam from each hot spring via the shared particle system. */
  emitSteam(particles, delta, rate) {
    if (!this.hotSprings.length) return;
    this._acc = (this._acc || 0) + delta * rate * this.hotSprings.length;
    while (this._acc >= 1) {
      this._acc -= 1;
      const hs = this.hotSprings[Math.floor(this.rng() * this.hotSprings.length)];
      const jitter = () => (this.rng() - 0.5) * 1.6;
      particles.emit(
        hs.x + jitter(), hs.y, hs.z + jitter(),
        (this.rng() - 0.5) * 0.3, 1.2 + this.rng() * 0.8, (this.rng() - 0.5) * 0.3,
        COLORS.STEAM, 2.2, 1.3
      );
    }
  }
}
