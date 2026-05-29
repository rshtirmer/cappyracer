import * as THREE from 'three';
import { ENV, COLORS } from '../core/Constants.js';

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
 * Static environment dressing around the circuit: GLB trees (instanced), GLB
 * rocks (instanced), and procedural hot-spring pools with steam (the capybara
 * theme). Positions derive from the track centerline so nothing lands on road.
 */
export class Scenery {
  constructor(scene, track, models) {
    this.scene = scene;
    this.track = track;
    this.models = models;
    this.rng = mulberry32(1337);
    this.hotSprings = [];

    this.buildTrees();
    this.buildRocks();
    this.buildHotSprings();
    this.buildPSXProps();
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

  /** Scatter `count` instances of a (possibly multi-part) GLB around the track. */
  placeInstances(gltf, count, minH, maxH, minDist, maxDist, tilt) {
    const parts = bakeUnitParts(gltf);
    const meshes = parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, count);
      im.castShadow = true;
      im.receiveShadow = true;
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
      p.set(x, 0, z);
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
