import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { KART, COLORS, ITEMS, DRIFT } from '../core/Constants.js';

/**
 * Arcade kart: a scalar forward `speed` plus a `heading` (yaw). Movement is
 * applied along the heading. Steering rotates the heading and scales with
 * speed, so the kart can't pivot in place. Lateral grip / drift comes later
 * (Milestone 04). Visual is a low-poly capybara sitting on a kart, built from
 * primitives as a placeholder for real GLB models.
 */
export class Kart {
  constructor(scene, kartColor = COLORS.KART_BODY) {
    this.scene = scene;
    this.kartColor = kartColor;
    this.speed = 0;                 // world units / second (negative = reverse)
    this.heading = KART.START_HEADING;
    this.surfaceGrip = 1;           // 1 = on road; <1 off-road (set by Game each frame)
    this._t = 0;                    // elapsed time (for bob animation)
    this.wheels = [];
    this.mixer = null;              // animation mixer for the GLB rider
    this.boostTimer = 0;            // > 0 = boost active (higher top speed)
    this.boostMult = ITEMS.BOOST_MULT;
    this.spinTimer = 0;             // > 0 = spinning out (no control)
    this.drifting = false;
    this.driftDir = 0;              // -1 / +1 : the locked slide direction
    this.driftCharge = 0;           // seconds held in a clean drift
    this.padCooldown = 0;           // boost-pad re-trigger cooldown

    this.mesh = this.buildMesh();
    this.mesh.position.set(KART.START_X, KART.START_Y, KART.START_Z);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);

    // Reusable temp to avoid per-frame allocation.
    this._fwd = new THREE.Vector3();
  }

  // --- Physics ---------------------------------------------------------------

  update(delta, input) {
    if (this.spinTimer > 0) { this.updateSpinOut(delta); return; }

    const throttle = -input.moveZ; // ArrowUp/W => +1 (forward), Down/S => -1
    const steer = input.moveX;     // Left/A => -1, Right/D => +1

    // Longitudinal speed
    if (throttle > 0) {
      this.speed += KART.ACCEL * throttle * delta;
    } else if (throttle < 0) {
      if (this.speed > 0.1) {
        this.speed -= KART.BRAKE_DECEL * delta;       // braking
      } else {
        this.speed += KART.REVERSE_ACCEL * throttle * delta; // reversing
      }
    } else {
      // Coast: drag pulls speed toward zero.
      if (this.speed > 0) this.speed = Math.max(0, this.speed - KART.DRAG * delta);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + KART.DRAG * delta);
    }
    // Surface grip caps speed; a boost (melon/drift/pad) raises the cap briefly.
    const boost = this.boostTimer > 0 ? this.boostMult : 1;
    const maxFwd = KART.MAX_SPEED * this.surfaceGrip * boost;
    const maxRev = KART.MAX_REVERSE * this.surfaceGrip;
    this.speed = Math.max(-maxRev, Math.min(maxFwd, this.speed));
    if (this.boostTimer > 0) this.boostTimer -= delta;
    if (this.padCooldown > 0) this.padCooldown -= delta;

    // Steering: scales with how fast we're going; sign(speed) makes reverse
    // steer the natural way. Zero at a standstill (no pivot-in-place).
    // Subtract so Left (moveX < 0) turns the kart toward screen-left.
    const speedFactor = Math.min(Math.abs(this.speed) / KART.TURN_SPEED_REF, 1);

    // Drift: hold the drift key + steer while moving fast to power-slide.
    const wantDrift = input.drift && this.speed > DRIFT.MIN_SPEED;
    if (wantDrift && !this.drifting && steer !== 0) {
      this.drifting = true;
      this.driftDir = steer < 0 ? -1 : 1;
      this.driftCharge = 0;
    }
    if (this.drifting && (!input.drift || this.speed < DRIFT.MIN_SPEED * 0.5)) {
      this.releaseDrift();
    }

    if (this.drifting) {
      let mod = 1;
      if (steer === this.driftDir) mod = 1.3;       // steer into the slide -> tighter
      else if (steer === -this.driftDir) mod = 0.6; // steer out -> wider
      this.heading -= this.driftDir * DRIFT.TURN_RATE * speedFactor * mod * delta;
      this.driftCharge += delta;
      this.speed *= Math.pow(DRIFT.GRIP_KEEP, delta);
    } else {
      this.heading -= steer * KART.TURN_RATE * speedFactor * Math.sign(this.speed) * delta;
    }

    // Translate along heading. heading 0 faces -Z (matches mesh.rotation.y=0).
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    this.mesh.position.x += fx * this.speed * delta;
    this.mesh.position.z += fz * this.speed * delta;
    this.mesh.rotation.y = this.heading;

    // Body lean — harder into a drift slide.
    const targetLean = this.drifting ? -this.driftDir * DRIFT.LEAN : -steer * speedFactor * 0.12;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetLean, 0.18);

    // Spin the wheels proportional to speed; bob the capybara a little.
    this._t += delta;
    const spin = (this.speed * delta) / 0.42; // /wheel radius
    for (const w of this.wheels) w.rotation.x += spin;
    if (this.capy) {
      const bob = Math.sin(this._t * 9) * 0.04 * Math.min(1, Math.abs(this.speed) / 6);
      this.capy.position.y = this._capyBaseY + bob;
    }
    if (this.mixer) this.mixer.update(delta);
  }

  /**
   * Swap the primitive capybara for the real rigged GLB model. Auto-normalizes
   * scale to KART.RIDER_HEIGHT, recenters it onto the seat, faces it forward,
   * and plays its idle animation. Safe to call after the kart already exists
   * (the model loads asynchronously).
   */
  /** The capybara player rider (auto-scaled to RIDER_HEIGHT + the head orange). */
  setRider(gltf, orangeGltf) {
    this._attachRider(gltf, {
      height: KART.RIDER_HEIGHT, yaw: KART.RIDER_YAW, upX: KART.RIDER_UP_X,
      seatY: KART.RIDER_SEAT_Y, seatZ: KART.RIDER_SEAT_Z, orangeGltf,
      // capybara keeps its established bone-extent sizing (unchanged look)
    });
  }

  /** A cute-animal rival rider (per-roster height/yaw/seat; no head orange). */
  setAnimalRider(gltf, cfg) {
    this._attachRider(gltf, {
      height: cfg.height ?? KART.RIVAL_HEIGHT, maxDim: cfg.maxDim, yaw: cfg.yaw ?? Math.PI, upX: cfg.upX ?? 0,
      seatX: cfg.seatX ?? 0, seatY: cfg.seatY ?? KART.RIDER_SEAT_Y, seatZ: cfg.seatZ ?? KART.RIDER_SEAT_Z,
      orangeGltf: null, animate: cfg.animate !== false, measureSurface: true,
    });
  }

  /**
   * Attach a GLB rider to the kart: clone, scale to `opts.height`, recenter onto
   * the seat, face it forward, play its idle clip. `opts.orangeGltf` mounts the
   * signature head orange (capybara only). Shared by the player + every rival so
   * sizing stays consistent (all heights are relative to the capybara's).
   */
  _attachRider(gltf, opts) {
    if (this.capy) { this.mesh.remove(this.capy); this.capy = null; }
    this.orange = null; // re-resolved by placeOrangeOnHead (capybara only)

    const model = cloneSkinned(gltf.scene);
    model.rotation.set(opts.upX || 0, opts.yaw ?? Math.PI, 0);

    // Skinned meshes report a near-zero geometry bbox (verts live in the bones),
    // so measure the real size from the skeleton bone world positions; static
    // meshes fall back to the geometry bbox.
    const measure = () => {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const tmp = new THREE.Vector3();
      let bones = 0;
      model.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton) {
          for (const b of o.skeleton.bones) { box.expandByPoint(b.getWorldPosition(tmp)); bones++; }
        }
        // For animal riders, also fold in each mesh's surface bounds so the FULL
        // top-to-bottom silhouette (spikes, ears, shell) is what gets normalized
        // — bones alone under-measure a spiky hedgehog.
        if (opts.measureSurface && o.isMesh && o.geometry) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
        }
      });
      if ((bones === 0 && !opts.measureSurface) || box.isEmpty()) box.setFromObject(model);
      return box;
    };

    const box1 = measure();
    const size = new THREE.Vector3();
    box1.getSize(size);
    // Scale by height by default; `maxDim` instead fits the LARGEST dimension to
    // a target (for models modelled flatter-than-tall, where height-scaling would
    // blow up their footprint — e.g. a curled hedgehog).
    const s = opts.maxDim
      ? opts.maxDim / (Math.max(size.x, size.y, size.z) || 1)
      : opts.height / (size.y || Math.max(size.x, size.z) || 1);
    model.scale.setScalar(s);

    // Recenter onto the seat: feet at y=0, centered in x/z.
    const box2 = measure();
    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });

    const rider = new THREE.Group();
    rider.add(model);
    rider.position.set(opts.seatX ?? 0, opts.seatY ?? 0, opts.seatZ ?? 0);
    this.mesh.add(rider);

    this.capy = rider;
    this._capyBaseY = opts.seatY ?? 0;

    this.mixer = null;
    if (opts.animate !== false && gltf.animations && gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(model);
      this.mixer.clipAction(gltf.animations[0]).play();
    }

    // Mount the signature orange on the head bone (so it follows the head).
    if (opts.orangeGltf) {
      let headBone = null;
      model.traverse((o) => {
        if (o.isBone && /head/i.test(o.name) && !/end/i.test(o.name) && !headBone) headBone = o;
      });
      this.placeOrangeOnHead(opts.orangeGltf, headBone);
    }
  }

  /** Balance the signature orange on the capybara's head. */
  placeOrangeOnHead(orangeGltf, headBone) {
    const orange = orangeGltf.scene.clone(true);
    orange.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(orange).getSize(size);
    orange.scale.setScalar(KART.ORANGE_HEAD_H / (size.y || 1)); // rider has unit scale
    orange.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    // Convert the head-bone world position into the rider group's local space.
    this.mesh.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    if (headBone) {
      headBone.getWorldPosition(pos);
      this.capy.worldToLocal(pos);
    } else {
      pos.set(0, KART.RIDER_HEIGHT, 0);
    }
    pos.y += KART.ORANGE_HEAD_LIFT;
    pos.z += KART.ORANGE_HEAD_Z;
    orange.position.copy(pos);
    orange.visible = false; // shown only while holding an item (see setHeldVisual)
    this.capy.add(orange);
    this.orange = orange;
  }

  /** Show/hide the head orange — the throwable yuzu you're carrying. */
  setHeldVisual(show) {
    if (this.orange) this.orange.visible = !!show;
  }

  /** While spun out: no control, spin in place, speed bleeds off. */
  updateSpinOut(delta) {
    this.spinTimer -= delta;
    this.heading += ITEMS.SPIN_RATE * delta;
    this.speed *= Math.pow(0.15, delta);
    this.mesh.position.x += -Math.sin(this.heading) * this.speed * delta;
    this.mesh.position.z += -Math.cos(this.heading) * this.speed * delta;
    this.mesh.rotation.set(0, this.heading, 0);
    this._t += delta;
    const spin = (this.speed * delta) / 0.42;
    for (const w of this.wheels) w.rotation.x += spin;
    if (this.mixer) this.mixer.update(delta);
  }

  /** Boost: instant speed bump + a window of raised top speed (melon/drift/pad). */
  applyBoost(mult = ITEMS.BOOST_MULT, time = ITEMS.BOOST_TIME) {
    this.boostTimer = Math.max(this.boostTimer, time);
    this.boostMult = mult;
    this.speed = Math.max(this.speed, KART.MAX_SPEED * mult);
  }

  /** End a drift and fire a boost sized by how long it was held. */
  releaseDrift() {
    if (this.driftCharge >= DRIFT.CHARGE_BIG) this.applyBoost(DRIFT.BOOST_BIG, DRIFT.TIME_BIG);
    else if (this.driftCharge >= DRIFT.CHARGE_MIN) this.applyBoost(DRIFT.BOOST_SMALL, DRIFT.TIME_SMALL);
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
  }

  /** Knock this kart into a spin-out for `time` seconds. */
  spinOut(time) {
    this.spinTimer = Math.max(this.spinTimer, time);
    this.speed *= 0.35;
  }

  /** Unit forward vector in world space. */
  forward(out = this._fwd) {
    return out.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  reset() {
    this.speed = 0;
    this.heading = KART.START_HEADING;
    this.surfaceGrip = 1;
    this.boostTimer = 0;
    this.spinTimer = 0;
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.padCooldown = 0;
    this.mesh.position.set(KART.START_X, KART.START_Y, KART.START_Z);
    this.mesh.rotation.set(0, this.heading, 0);
  }

  /** Place the kart at a world position + heading (spawn / test poses). */
  setPose(position, heading, keepSpeed = false) {
    this.mesh.position.set(position.x, 0, position.z);
    this.heading = heading;
    this.mesh.rotation.set(0, heading, 0);
    if (!keepSpeed) this.speed = 0;
  }

  // --- Visual (placeholder primitives) --------------------------------------

  buildMesh() {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

    // Kart chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.4), mat(this.kartColor));
    chassis.position.y = 0.55;
    g.add(chassis);

    // Front bumper trim
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 0.4), mat(COLORS.KART_TRIM));
    bumper.position.set(0, 0.5, -1.25);
    g.add(bumper);

    // Wheels: each in a pivot so we can roll it (pivot.rotation.x) regardless
    // of the cylinder being laid on its side.
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 14);
    const wheelMat = mat(COLORS.WHEEL);
    const wheelPositions = [
      [-0.85, 0.42, -0.8], [0.85, 0.42, -0.8],
      [-0.85, 0.42, 0.9], [0.85, 0.42, 0.9],
    ];
    this.wheels = [];
    for (const [x, y, z] of wheelPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; // axle along X
      pivot.add(w);
      g.add(pivot);
      this.wheels.push(pivot);
    }

    // --- Capybara sitting in the kart, facing -Z ---
    const capy = new THREE.Group();
    this._capyBaseY = 0.78;
    capy.position.set(0, this._capyBaseY, 0.15);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 1.3), mat(COLORS.CAPY_BODY));
    body.position.y = 0.45;
    capy.add(body);

    // Head (toward -Z front)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.8), mat(COLORS.CAPY_BODY));
    head.position.set(0, 0.95, -0.75);
    capy.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.35), mat(COLORS.CAPY_SNOUT));
    snout.position.set(0, 0.82, -1.18);
    capy.add(snout);

    // Ears
    const earGeo = new THREE.BoxGeometry(0.22, 0.22, 0.14);
    const earMat = mat(COLORS.CAPY_BODY_DARK);
    for (const ex of [-0.3, 0.3]) {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(ex, 1.38, -0.6);
      capy.add(ear);
    }

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.06);
    const eyeMat = mat(COLORS.CAPY_EYE);
    for (const ex of [-0.24, 0.24]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ex, 1.05, -1.12);
      capy.add(eye);
    }

    // The signature orange on the head + a little leaf
    const orange = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat(COLORS.ORANGE));
    orange.position.set(0, 1.5, -0.55);
    capy.add(orange);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.1), mat(COLORS.LEAF));
    leaf.position.set(0, 1.75, -0.55);
    capy.add(leaf);

    g.add(capy);
    this.capy = capy;

    // Everything on the kart casts shadows.
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  destroy() {
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.scene.remove(this.mesh);
  }
}
