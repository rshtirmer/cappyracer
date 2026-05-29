import * as THREE from 'three';
import { FX } from '../core/Constants.js';

/**
 * A pooled particle system backed by a single InstancedMesh (one draw call).
 * Used for kart dust and hot-spring steam. Particles fade by scaling to zero
 * over their lifetime, so no per-instance alpha blending is needed.
 */
export class ParticleSystem {
  constructor(scene, max = FX.PARTICLE_MAX) {
    this.max = max;
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.userData.noPS2 = true;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    scene.add(this.mesh);

    this.pos = new Array(max);
    this.vel = new Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      this.pos[i] = new THREE.Vector3();
      this.vel[i] = new THREE.Vector3();
    }
    this.next = 0;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._zero = new THREE.Vector3(0, 0, 0);
    this._color = new THREE.Color();

    // Hide all instances initially.
    for (let i = 0; i < max; i++) {
      this._m.compose(this._zero, this._q, this._zero);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(x, y, z, vx, vy, vz, color, life, size) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i].set(x, y, z);
    this.vel[i].set(vx, vy, vz);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this._color.set(color);
    this.mesh.setColorAt(i, this._color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(delta) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= delta;
      const p = this.pos[i];
      const v = this.vel[i];
      p.x += v.x * delta;
      p.y += v.y * delta;
      p.z += v.z * delta;
      v.multiplyScalar(0.96); // drag
      if (this.life[i] <= 0) {
        this._m.compose(this._zero, this._q, this._zero); // hide
      } else {
        const k = this.life[i] / this.maxLife[i];
        const s = this.size[i] * (0.3 + 0.7 * k); // shrink as it dies
        this._s.set(s, s, s);
        this._m.compose(p, this._q, this._s);
      }
      this.mesh.setMatrixAt(i, this._m);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
