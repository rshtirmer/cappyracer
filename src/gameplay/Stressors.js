import * as THREE from 'three';
import { STRESSOR, COLORS, FX } from '../core/Constants.js';
import { disposeObject3D } from '../core/disposeUtils.js';

/**
 * Stressors: the inverted hazard. Each is a trigger volume on the track that
 * spikes a kart's heart rate (drains calm) while it sits inside the radius —
 * the exact proximity pattern as boost pads, opposite effect. A fireworks
 * launcher pops sparks; a chihuahua yaps and wiggles. Built from primitives for
 * the prototype (swap for GLB/sprites later). Lives in the world group so it
 * disposes with the rest of the level.
 */
export class Stressors {
  constructor(scene, track, particles, defs = []) {
    this.scene = scene;
    this.particles = particles;
    this.zones = [];
    this._t = 0;
    for (const def of defs) {
      const s = track.pointAt(def.progress);
      const group = new THREE.Group();
      group.position.set(s.pos.x, 0, s.pos.z);

      // Danger ring on the ground (the "stay back" tell).
      const ringGeo = new THREE.RingGeometry(STRESSOR.RADIUS - 0.7, STRESSOR.RADIUS, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.STRESS_ZONE, transparent: true, opacity: 0.5,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.07;
      ring.renderOrder = 2;
      ring.userData.noPS2 = true;
      group.add(ring);

      const obj = def.type === 'chihuahua' ? buildChihuahua() : buildFirework();
      group.add(obj);

      scene.add(group);
      this.zones.push({ type: def.type, pos: group.position, group, ring, obj, popT: 0 });
    }
  }

  /** Drain calm for any kart inside a zone; animate the props + fireworks. */
  update(delta, racers) {
    this._t += delta;
    for (const z of this.zones) {
      // Pulse the ring so it reads as "live / dangerous".
      z.ring.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(this._t * 4));

      if (z.type === 'chihuahua') {
        // Frantic little bounce + wiggle (the yapping energy).
        z.obj.position.y = 0.18 + Math.abs(Math.sin(this._t * 14)) * 0.18;
        z.obj.rotation.y = Math.sin(this._t * 9) * 0.5;
      } else {
        // Fire a spark burst on a steady cadence.
        z.popT -= delta;
        if (z.popT <= 0) {
          z.popT = 0.7;
          this._burst(z.pos);
        }
      }

      for (const racer of racers) {
        if (dist2(racer.kart.mesh.position, z.pos) < STRESSOR.RADIUS ** 2) {
          racer.kart.stress(STRESSOR.DRAIN * delta);
        }
      }
    }
  }

  /** A quick upward shower of sparks from a firework launcher. */
  _burst(pos) {
    if (!this.particles) return;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 5;
      this.particles.emit(
        pos.x, 2.2, pos.z,
        Math.cos(a) * sp * 0.5, 6 + Math.random() * 5, Math.sin(a) * sp * 0.5,
        Math.random() < 0.5 ? COLORS.FIREWORK : COLORS.STRESS_ZONE,
        FX.DUST_LIFE * 1.6, FX.DUST_SIZE * 1.1
      );
    }
  }

  reset() { this._t = 0; for (const z of this.zones) z.popT = 0; }

  dispose() {
    for (const z of this.zones) { this.scene.remove(z.group); disposeObject3D(z.group); }
    this.zones.length = 0;
  }
}

function mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

/** A simple firework launcher: a stubby tube on a base. */
function buildFirework() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.3, 10), mat(0x444a55));
  base.position.y = 0.15;
  g.add(base);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 10), mat(COLORS.STRESS_ZONE));
  tube.position.y = 1.1;
  g.add(tube);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.4, 10), mat(COLORS.FIREWORK));
  cap.position.y = 2.1;
  g.add(cap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** A tiny yappy chihuahua (chunky primitives). */
function buildChihuahua() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.8), mat(COLORS.CHIHUAHUA));
  body.position.y = 0.45;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.42), mat(COLORS.CHIHUAHUA));
  head.position.set(0, 0.7, -0.5);
  g.add(head);
  const earGeo = new THREE.ConeGeometry(0.13, 0.32, 4);
  for (const ex of [-0.16, 0.16]) {
    const ear = new THREE.Mesh(earGeo, mat(0xcbb78a));
    ear.position.set(ex, 1.02, -0.5);
    g.add(ear);
  }
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.2), mat(0x2a2218));
  snout.position.set(0, 0.66, -0.74);
  g.add(snout);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), mat(COLORS.CHIHUAHUA));
  tail.position.set(0, 0.6, 0.5);
  g.add(tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.y = 0.18;
  return g;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}
