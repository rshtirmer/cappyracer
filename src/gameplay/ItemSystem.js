import * as THREE from 'three';
import { ITEMS, BOOST_PAD, COLORS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { disposeObject3D } from '../core/disposeUtils.js';
import { makeItemBox, makeYuzu, makeBoostPadTexture } from './itemMeshes.js';

/**
 * Item boxes on the track grant a random power-up; racers fire/drop/use them.
 *   - shell: forward projectile that spins out whoever it hits
 *   - mud:   dropped hazard that briefly spins out a kart that drives over it
 *   - melon: instant personal speed boost
 * One item held at a time. The player uses via input; AI auto-use after a delay.
 */
export class ItemSystem {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.boxes = [];
    this.projectiles = [];
    this.hazards = [];
    this.pads = [];
    this.orangeGltf = null; // set by Game once loaded; yuzu projectile clones it
    this.buildBoxes();
    this.buildPads();
  }

  /** Provide the orange GLB so thrown "shells" render as a tumbling yuzu. */
  setYuzu(orangeGltf) { this.orangeGltf = orangeGltf; }

  buildPads() {
    const size = BOOST_PAD.RADIUS * 1.6;
    const geo = new THREE.PlaneGeometry(size, size);
    const tex = makeBoostPadTexture();
    const up = new THREE.Vector3(0, 1, 0);
    for (const progress of BOOST_PAD.PROGRESSES) {
      const s = this.track.pointAt(progress);
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.BOOST_PAD, map: tex, transparent: true, opacity: 0.9,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      // Lay flat (plane normal -> up) with the chevrons (texture +v) pointing
      // along the driving direction (+tangent). Basis vectors avoid Euler-order
      // guesswork: local x->right, y->forward, z->up.
      const fwd = new THREE.Vector3(s.tan.x, 0, s.tan.z).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, up);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, fwd, up));
      mesh.position.set(s.pos.x, 0.09, s.pos.z);
      mesh.renderOrder = 2;
      mesh.userData.noPS2 = true;
      this.scene.add(mesh);
      this.pads.push({ pos: mesh.position, mesh });
    }
  }

  buildBoxes() {
    for (const progress of ITEMS.BOX_PROGRESSES) {
      const s = this.track.pointAt(progress);
      const mesh = makeItemBox(); // glowing "?" mystery box (a Group)
      mesh.position.set(s.pos.x, ITEMS.BOX_Y, s.pos.z);
      this.scene.add(mesh);
      this.boxes.push({ mesh, pos: mesh.position, active: true, respawn: 0 });
    }
  }

  reset() {
    for (const b of this.boxes) { b.active = true; b.respawn = 0; b.mesh.visible = true; }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const h of this.hazards) this.scene.remove(h.mesh);
    this.projectiles.length = 0;
    this.hazards.length = 0;
  }

  grant(racer) {
    const type = ITEMS.TYPES[Math.floor(Math.random() * ITEMS.TYPES.length)];
    racer.heldItem = type;
    if (racer.ai) {
      racer.itemUseTimer = ITEMS.AI_USE_MIN + Math.random() * (ITEMS.AI_USE_MAX - ITEMS.AI_USE_MIN);
    }
    eventBus.emit(Events.ITEM_PICKUP, { type, isPlayer: racer.isPlayer });
  }

  useItem(racer, racers) {
    const type = racer.heldItem;
    if (!type) return;
    racer.heldItem = null;
    const kart = racer.kart;
    const h = kart.heading;
    const fx = -Math.sin(h);
    const fz = -Math.cos(h);
    const p = kart.mesh.position;

    if (type === 'melon') {
      kart.applyBoost();
    } else if (type === 'shell') {
      const mesh = makeYuzu(this.orangeGltf); // tumbling yuzu projectile
      mesh.position.set(p.x + fx * 2.5, 0.8, p.z + fz * 2.5);
      this.scene.add(mesh);
      this.projectiles.push({ mesh, vel: { x: fx * ITEMS.SHELL_SPEED, z: fz * ITEMS.SHELL_SPEED }, owner: racer, life: ITEMS.SHELL_LIFE });
    } else if (type === 'mud') {
      const geo = new THREE.CircleGeometry(1.6, 16);
      const mat = new THREE.MeshLambertMaterial({ color: COLORS.MUD, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x - fx * 2.5, 0.08, p.z - fz * 2.5);
      mesh.userData.noPS2 = true;
      this.scene.add(mesh);
      this.hazards.push({ mesh, pos: mesh.position, life: ITEMS.MUD_LIFE });
    }
    eventBus.emit(Events.ITEM_USED, { type, isPlayer: racer.isPlayer });
  }

  update(delta, racers) {
    this._t = (this._t || 0) + delta;

    // Boost pads: drive over one (cooldown-gated) for a speed burst.
    for (const pad of this.pads) {
      pad.mesh.material.opacity = 0.7 + 0.3 * Math.abs(Math.sin(this._t * 5));
      for (const racer of racers) {
        const kart = racer.kart;
        if (kart.padCooldown > 0) continue;
        if (dist2(kart.mesh.position, pad.pos) < BOOST_PAD.RADIUS ** 2) {
          kart.applyBoost(BOOST_PAD.BOOST_MULT, BOOST_PAD.BOOST_TIME);
          kart.padCooldown = BOOST_PAD.COOLDOWN;
          eventBus.emit(Events.ITEM_HIT, { type: 'pad', isPlayer: racer.isPlayer });
        }
      }
    }

    // Boxes: spin/bob, pickups, respawn.
    for (const box of this.boxes) {
      if (box.active) {
        box.mesh.rotation.y += delta * 2;
        box.mesh.position.y = ITEMS.BOX_Y + Math.sin(this._t * 3) * 0.15;
        if (box.mesh.userData.core) box.mesh.userData.core.rotation.y -= delta * 3;
        for (const racer of racers) {
          if (racer.heldItem || (racer.kart.spinTimer > 0)) continue;
          if (dist2(racer.kart.mesh.position, box.pos) < ITEMS.BOX_PICKUP_DIST ** 2) {
            this.grant(racer);
            box.active = false;
            box.respawn = ITEMS.BOX_RESPAWN;
            box.mesh.visible = false;
            break;
          }
        }
      } else {
        box.respawn -= delta;
        if (box.respawn <= 0) { box.active = true; box.mesh.visible = true; }
      }
    }

    // AI auto-use.
    for (const racer of racers) {
      if (racer.ai && racer.heldItem) {
        racer.itemUseTimer -= delta;
        if (racer.itemUseTimer <= 0) this.useItem(racer, racers);
      }
    }

    // Shell projectiles.
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= delta;
      pr.mesh.position.x += pr.vel.x * delta;
      pr.mesh.position.z += pr.vel.z * delta;
      pr.mesh.rotation.y += delta * 9; // tumble
      pr.mesh.rotation.x += delta * 5;
      let hit = false;
      for (const racer of racers) {
        if (racer === pr.owner || racer.kart.spinTimer > 0) continue;
        if (dist2(racer.kart.mesh.position, pr.mesh.position) < ITEMS.SHELL_HIT_DIST ** 2) {
          racer.kart.spinOut(ITEMS.SPIN_TIME);
          eventBus.emit(Events.ITEM_HIT, { type: 'shell', isPlayer: racer.isPlayer });
          hit = true;
          break;
        }
      }
      if (hit || pr.life <= 0) {
        this.scene.remove(pr.mesh);
        disposeObject(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Mud hazards.
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      hz.life -= delta;
      for (const racer of racers) {
        if (racer.kart.spinTimer > 0) continue;
        if (dist2(racer.kart.mesh.position, hz.pos) < ITEMS.MUD_HIT_DIST ** 2) {
          racer.kart.spinOut(ITEMS.MUD_SPIN_TIME);
          eventBus.emit(Events.ITEM_HIT, { type: 'mud', isPlayer: racer.isPlayer });
        }
      }
      if (hz.life <= 0) {
        this.scene.remove(hz.mesh);
        disposeObject(hz.mesh);
        this.hazards.splice(i, 1);
      }
    }
  }
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/**
 * Dispose a removed item object. The mud hazard + sphere-fallback yuzu own unique
 * geometry/materials and are freed; the GLB-clone yuzu flags its borrowed
 * resources shared so only its wrapper is released.
 */
function disposeObject(obj) {
  disposeObject3D(obj);
}
