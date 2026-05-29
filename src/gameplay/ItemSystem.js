import * as THREE from 'three';
import { ITEMS, BOOST_PAD, COLORS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';

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
    this.buildBoxes();
    this.buildPads();
  }

  buildPads() {
    const geo = new THREE.CircleGeometry(BOOST_PAD.RADIUS * 0.7, 24);
    const mat = new THREE.MeshLambertMaterial({
      color: COLORS.BOOST_PAD, emissive: COLORS.BOOST_PAD, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.85,
    });
    for (const progress of BOOST_PAD.PROGRESSES) {
      const s = this.track.pointAt(progress);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(s.pos.x, 0.09, s.pos.z);
      mesh.userData.noPS2 = true;
      this.scene.add(mesh);
      this.pads.push({ pos: mesh.position, mesh });
    }
  }

  buildBoxes() {
    const geo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const mat = new THREE.MeshLambertMaterial({
      color: COLORS.ITEM_BOX, emissive: COLORS.ITEM_BOX_EDGE, emissiveIntensity: 0.4,
    });
    for (const progress of ITEMS.BOX_PROGRESSES) {
      const s = this.track.pointAt(progress);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.pos.x, ITEMS.BOX_Y, s.pos.z);
      mesh.castShadow = true;
      mesh.userData.noPS2 = true;
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
      const geo = new THREE.SphereGeometry(0.5, 12, 10);
      const mat = new THREE.MeshLambertMaterial({ color: COLORS.SHELL, emissive: COLORS.SHELL, emissiveIntensity: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.noPS2 = true;
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
      pad.mesh.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(this._t * 5);
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
        pr.mesh.geometry.dispose();
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
        hz.mesh.geometry.dispose();
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
