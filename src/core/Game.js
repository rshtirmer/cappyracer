import * as THREE from 'three';
import { GAME, CAMERA, COLORS, TRACK, RACE, KART, FX, MODELS, PS2, BLOOM, AI, LEVEL } from './Constants.js';
import { Save } from './Save.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { eventBus, Events } from './EventBus.js';
import { gameState } from './GameState.js';
import { InputSystem } from '../systems/InputSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { Kart } from '../gameplay/Kart.js';
import { LapTracker } from '../gameplay/LapTracker.js';
import { AIController } from '../gameplay/AIController.js';
import { ItemSystem } from '../gameplay/ItemSystem.js';
import { Traffic } from '../gameplay/Traffic.js';
import { LevelBuilder } from '../level/LevelBuilder.js';
import { Track } from '../level/Track.js';
import { getTrackDef, TRACK_DEFS, MAIN_TRACK_COUNT } from '../level/tracks.js';
import { Sky } from '../level/Sky.js';
import { Scenery } from '../level/Scenery.js';
import { AssetLoader } from '../level/AssetLoader.js';
import { applyVertexSnapToScene } from '../systems/Retro.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';

export class Game {
  constructor() {
    this.clock = new THREE.Clock();

    // Renderer
    // antialias off + low internal resolution = chunky PS2 pixels.
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(COLORS.SKY);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.prepend(this.renderer.domElement);
    this.renderer.domElement.style.width = '100vw';
    this.renderer.domElement.style.height = '100vh';
    this.renderer.domElement.style.imageRendering = 'pixelated';

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      GAME.FOV,
      window.innerWidth / window.innerHeight,
      GAME.NEAR,
      GAME.FAR
    );
    this.camera.position.set(0, CAMERA.HEIGHT, CAMERA.DISTANCE);
    this.camera.lookAt(0, CAMERA.LOOK_OFFSET_Y, 0);
    this.updatePixelation();
    this.setupComposer();
    this._menuT = 0;

    // Persistent systems (survive track switches).
    this.input = new InputSystem();
    this.particles = new ParticleSystem(this.scene);
    this.hud = new HUD();
    this.menu = new Menu();
    this.racers = [];     // [player, ...AI], each { kart, ai, lapTracker, ... }
    this.player = null;   // alias for racers[0].kart
    this._dustAcc = 0;
    this._finishCount = 0;

    // Per-track world objects live under worldGroup so a track switch can swap
    // them out without touching karts/particles/camera.
    this.worldGroup = null;
    this.scenery = null;
    this.models = null;
    this.modelsLoaded = false;

    // Active track from ?track=N (default 0); the menu switches live.
    const params = new URLSearchParams(window.location.search);
    this.trackIndex = parseInt(params.get('track'), 10) || 0;
    this.trackDef = getTrackDef(this.trackIndex);
    this.buildWorld(this.trackDef);

    // Load GLB assets; build scenery + the racer grid when ready.
    this.capyGltf = null;
    this.orangeGltf = null;
    this.assets = new AssetLoader();
    Promise.all([
      this.assets.load(MODELS.CAPYBARA),
      this.assets.load(MODELS.ORANGE),
      this.assets.load(MODELS.TREE1),
      this.assets.load(MODELS.TREE2),
      this.assets.load(MODELS.ROCK),
      this.assets.load(MODELS.BARREL),
      this.assets.load(MODELS.CRATE),
      this.assets.load(MODELS.BARRICADE),
    ])
      .then(([capy, orange, tree1, tree2, rock, barrel, crate, barricade]) => {
        this.capyGltf = capy;
        this.orangeGltf = orange;
        this.models = { tree1, tree2, rock, barrel, crate, barricade };
        this.modelsLoaded = true;
        this.buildScenery();
        if (this.racers.length) this.attachRiders();
        else this.ensureRacers(); // show the full grid on the title screen
      })
      .catch((e) => console.error('Failed to load models:', e));

    // Reusable temps (avoid per-frame allocation)
    this._camTarget = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this.camYaw = 0; // smoothed camera yaw (set on spawn)

    // Events
    eventBus.on(Events.GAME_START, () => this.startGame());
    eventBus.on(Events.GAME_RESTART, () => this.restart());
    eventBus.on(Events.TRACK_SELECT, (index) => this.selectTrack(index));

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  // --- World (per-track) build / swap -----------------------------------------

  buildWorld(def) {
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    // theme.env drives lighting/sky/scenery presets; carry the def's env onto it.
    const theme = { ...def.theme, env: def.env || 'springs' };
    this.laps = def.laps ?? RACE.LAPS;
    gameState.totalLaps = this.laps;
    this.level = new LevelBuilder(this.worldGroup, theme);
    this.track = new Track(this.worldGroup, def);
    this.items = new ItemSystem(this.worldGroup, this.track);
    this.sky = new Sky(this.worldGroup, theme);
    // Highway "no-hesi" traffic to weave through (bonus track only).
    this.traffic = def.env === 'highway' ? new Traffic(this.worldGroup, this.track) : null;
    this.scene.fog = new THREE.Fog(def.theme.fog ?? LEVEL.FOG_COLOR, LEVEL.FOG_NEAR, LEVEL.FOG_FAR);
    if (this.modelsLoaded) this.buildScenery();
    applyVertexSnapToScene(this.worldGroup, PS2.VERTEX_SNAP);
  }

  buildScenery() {
    if (!this.modelsLoaded || !this.worldGroup) return;
    const theme = { ...this.trackDef.theme, env: this.trackDef.env || 'springs' };
    this.scenery = new Scenery(this.worldGroup, this.track, this.models, theme);
    applyVertexSnapToScene(this.worldGroup, PS2.VERTEX_SNAP);
  }

  disposeWorld() {
    if (!this.worldGroup) return;
    this.scene.remove(this.worldGroup);
    this.worldGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x && x.dispose && x.dispose());
    });
    this.worldGroup = null;
    this.scenery = null;
    this.traffic = null;
  }

  /** Switch to track `index` in place (rebuild the world, re-grid the field). */
  selectTrack(index) {
    if (!Save.isUnlocked(index)) return false;
    this.disposeWorld();
    this.trackIndex = index;
    this.trackDef = getTrackDef(index);
    this.buildWorld(this.trackDef);
    if (this.racers.length) this.gridAll();
    return true;
  }

  /** Place all racers on the current track's start grid (no race-state change). */
  gridAll() {
    this.racers.forEach((r, i) => {
      r.kart.reset();
      const pose = this.gridPose(i);
      r.kart.setPose(pose.position, pose.heading);
      r.lapTracker.reset();
      r.lastProgress = 0;
      r.crossedStart = false;
    });
    this.snapCameraToKart();
  }

  startGame() {
    gameState.reset();
    gameState.started = true;
    gameState.totalLaps = this.laps;
    gameState.countdown = RACE.COUNTDOWN;
    this._finishCount = 0;
    this._goTimer = RACE.GO_HOLD;
    this.ensureRacers();
    this.racers.forEach((r, i) => {
      r.kart.reset();
      const pose = this.gridPose(i);
      r.kart.setPose(pose.position, pose.heading);
      r.lapTracker.reset();
      r.lastProgress = 0;
      r.crossedStart = false;
      r.finished = false;
      r.finishPlace = 0;
      r.finishTime = 0;
      r.position = i + 1;
      r.heldItem = null;
    });
    this.items.reset();
    this.snapCameraToKart();
    this.hud.show();
    this.hud.setCountdown(String(RACE.COUNTDOWN));
  }

  restart() {
    for (const r of this.racers) r.kart.destroy();
    this.racers = [];
    this.player = null;
    gameState.reset();
    this._finishCount = 0;
    this.ensureRacers(); // keep the grid on screen for the title orbit
    this.menu.showStart();
  }

  /** A staggered start-grid pose (3 rows x 2 columns) behind the start line. */
  gridPose(i) {
    const s = this.track.samples[0];
    const row = Math.floor(i / 2);
    const col = i % 2;
    const back = AI.GRID_START_BACK + row * AI.GRID_ROW_GAP;
    const lat = (col === 0 ? -1 : 1) * AI.GRID_LANE;
    return {
      position: {
        x: s.pos.x - s.tan.x * back + s.normal.x * lat,
        z: s.pos.z - s.tan.z * back + s.normal.z * lat,
      },
      heading: Math.atan2(-s.tan.x, -s.tan.z),
    };
  }

  /** Create the player + AI racers on the grid (idempotent). */
  ensureRacers() {
    if (this.racers.length) return;
    for (let i = 0; i < RACE.RACERS; i++) {
      const isPlayer = i === 0;
      const color = isPlayer ? COLORS.KART_BODY : AI.RIVAL_COLORS[(i - 1) % AI.RIVAL_COLORS.length];
      const kart = new Kart(this.scene, color);
      const pose = this.gridPose(i);
      kart.setPose(pose.position, pose.heading);
      if (this.capyGltf) kart.setRider(this.capyGltf, this.orangeGltf);
      const ai = isPlayer
        ? null
        : new AIController(AI.LANES[(i - 1) % AI.LANES.length], AI.SKILL[(i - 1) % AI.SKILL.length]);
      this.racers.push({
        kart, ai, lapTracker: new LapTracker(), lastProgress: 0, crossedStart: false,
        finished: false, finishPlace: 0, finishTime: 0, isPlayer, position: i + 1,
        heldItem: null, itemUseTimer: 0,
      });
    }
    this.player = this.racers[0].kart;
  }

  attachRiders() {
    for (const r of this.racers) r.kart.setRider(this.capyGltf, this.orangeGltf);
  }

  /** Test hook: drop the AI so the player can be measured in isolation. */
  removeAI() {
    for (let i = this.racers.length - 1; i >= 1; i--) {
      this.racers[i].kart.destroy();
      this.racers.splice(i, 1);
    }
  }

  setupComposer() {
    const w = Math.max(1, Math.floor(window.innerWidth * PS2.RES_SCALE));
    const h = Math.max(1, Math.floor(window.innerHeight * PS2.RES_SCALE));
    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), BLOOM.STRENGTH, BLOOM.RADIUS, BLOOM.THRESHOLD);
    this.composer.addPass(this.bloom);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), GAME.MAX_DELTA);
    this.update(delta);
    this.composer.render();
  }

  /** Advance the simulation by `delta` seconds (driven by animate + advanceTime). */
  update(delta) {
    this.input.update();

    // Ambient world life runs even on the menu.
    this.sky.update(delta);
    if (this.scenery) this.scenery.emitSteam(this.particles, delta, FX.STEAM_RATE);
    this.particles.update(delta);
    // Highway traffic circulates always; only clips the player while racing.
    if (this.traffic) {
      const racing = gameState.started && !gameState.finished && gameState.countdown <= 0;
      this.traffic.update(delta, this.racers, racing);
    }

    if (gameState.started && !gameState.finished && this.racers.length) {
      if (gameState.countdown > 0) {
        // 3-2-1 hold: freeze the field, show the countdown, keep the camera set.
        gameState.countdown -= delta;
        this.idleRiders(delta);
        this.snapCameraToKart();
        this.hud.setCountdown(gameState.countdown > 0 ? String(Math.ceil(gameState.countdown)) : 'GO!');
      } else {
        this.updateRace(delta);
        if (this._goTimer > 0) {
          this._goTimer -= delta;
          if (this._goTimer <= 0) this.hud.setCountdown('');
        }
      }
    } else if (!gameState.started) {
      // Title screen: idle the riders + slow cinematic orbit of the start line.
      this.idleRiders(delta);
      this.updateMenuCamera(delta);
    } else {
      this.idleRiders(delta); // finished: keep the riders breathing
    }
  }

  idleRiders(delta) {
    for (const r of this.racers) if (r.kart.mixer) r.kart.mixer.update(delta);
  }

  /** One simulation step for the whole field. */
  updateRace(delta) {
    gameState.raceTime += delta;
    for (const racer of this.racers) {
      const input = racer.ai ? racer.ai.computeInput(racer.kart, this.track) : this.input;
      racer.kart.update(delta, input);
      if (racer.ai) racer.ai.capSpeed(racer.kart);
      this.updateRacerTrack(racer, delta);
    }

    // Items: player fires/uses on input; the system handles AI use + effects.
    const player = this.racers[0];
    if (this.input.consumeUse() && player.heldItem) this.items.useItem(player, this.racers);
    this.items.update(delta, this.racers);
    gameState.heldItem = player.heldItem;

    this.resolveCollisions();
    this.updatePositions();
    this.emitDust(delta);     // player only
    this.updateCamera(delta); // follows the player
    this.hud.update(gameState);
  }

  /** Slow orbit around the capybara on the start line — the title-screen shot. */
  updateMenuCamera(delta) {
    this._menuT += delta;
    const f = this.player ? this.player.mesh.position : this.track.startPose.position;
    const a = this._menuT * 0.22;
    const r = 9.5;
    this.camera.position.set(f.x + Math.sin(a) * r, f.y + 4.2, f.z + Math.cos(a) * r);
    this.camera.lookAt(f.x, f.y + 1.4, f.z);
    if (Math.abs(this.camera.fov - FX.FOV_BASE) > 0.01) {
      this.camera.fov = FX.FOV_BASE;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Kick up dust behind the kart when moving — more on grass. */
  emitDust(delta) {
    const kart = this.player;
    const spd = Math.abs(kart.speed);
    if (spd < 3) return;
    const rate = (gameState.onTrack ? FX.DUST_RATE_ONROAD : FX.DUST_RATE_OFFROAD)
      * Math.min(1, spd / KART.MAX_SPEED + 0.3);
    this._dustAcc += delta * rate;
    const fwdx = -Math.sin(kart.heading);
    const fwdz = -Math.cos(kart.heading);
    const j = () => (Math.random() - 0.5);
    while (this._dustAcc >= 1) {
      this._dustAcc -= 1;
      this.particles.emit(
        kart.mesh.position.x - fwdx * 1.2 + j() * 0.8,
        0.25,
        kart.mesh.position.z - fwdz * 1.2 + j() * 0.8,
        j() * 0.6, 0.5 + Math.random() * 0.6, j() * 0.6,
        COLORS.DUST, FX.DUST_LIFE, FX.DUST_SIZE
      );
    }
  }

  /** Off-track grip, wall clamping, and lap counting for one racer. */
  updateRacerTrack(racer, delta) {
    const kart = racer.kart;
    const loc = this.track.locate(kart.mesh.position);

    // Wall: clamp the lateral excess back onto the wall band, bleed speed.
    const half = this.track.wallHalf;
    if (loc.offset > half || loc.offset < -half) {
      const clamped = Math.max(-half, Math.min(half, loc.offset));
      const excess = loc.offset - clamped;
      const s = this.track.samples[loc.index];
      kart.mesh.position.x -= s.normal.x * excess;
      kart.mesh.position.z -= s.normal.z * excess;
      kart.speed *= TRACK.WALL_SPEED_KEEP;
    }

    const onTrack = Math.abs(loc.offset) <= this.track.roadHalf;
    kart.surfaceGrip = onTrack ? 1 : TRACK.OFFTRACK_GRIP;

    // Mark the first forward crossing of the start line (run-up complete) so
    // position ranking doesn't treat grid racers (progress ~0.98) as leaders.
    const prev = racer.lastProgress;
    if (!racer.crossedStart && prev > 0.6 && loc.progress < 0.4) racer.crossedStart = true;
    racer.lastProgress = loc.progress;

    const completed = racer.lapTracker.update(loc.progress);
    if (completed && racer.lapTracker.lap >= this.laps && !racer.finished) {
      this.finish(racer);
    }

    if (racer.isPlayer) {
      gameState.onTrack = onTrack;
      gameState.progress = loc.progress;
      gameState.offset = loc.offset;
      gameState.lap = racer.lapTracker.lap;
      gameState.gate = racer.lapTracker.nextGate;
      if (completed && !racer.finished) {
        eventBus.emit(Events.LAP_COMPLETED, { lap: racer.lapTracker.lap, total: this.laps });
      }
    }
  }

  /** Separate any overlapping karts (circle-circle) and bleed a little speed. */
  resolveCollisions() {
    const r = AI.COLLIDE_DIST;
    const n = this.racers.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.racers[i].kart.mesh.position;
        const b = this.racers[j].kart.mesh.position;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-4) { dx = 0.1; dz = 0; d = 0.1; }
        const overlap = (r - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * overlap; a.z -= nz * overlap;
        b.x += nx * overlap; b.z += nz * overlap;
        this.racers[i].kart.speed *= 0.92;
        this.racers[j].kart.speed *= 0.92;
      }
    }
  }

  /** Rank racers by lap + progress; record the player's live position. */
  updatePositions() {
    const ranked = this.racers
      .map((r) => ({ r, p: r.lapTracker.lap + r.lastProgress - (r.crossedStart ? 0 : 1) }))
      .sort((x, y) => y.p - x.p);
    ranked.forEach((e, i) => { e.r.position = i + 1; });
    gameState.position = this.racers[0].position;
    gameState.totalRacers = this.racers.length;
  }

  finish(racer) {
    racer.finished = true;
    racer.finishPlace = ++this._finishCount;
    racer.finishTime = gameState.raceTime;
    if (racer.isPlayer) {
      gameState.recordFinish();
      gameState.position = racer.finishPlace;
      const newBest = Save.recordTime(this.trackDef.id, gameState.raceTime);
      // A podium finish on the newest unlocked MAIN track opens the next one.
      // The bonus track sits outside this linear progression.
      let unlockedNew = false;
      if (racer.finishPlace <= 3 && !this.trackDef.bonus) {
        const before = Save.unlockedCount();
        if (this.trackIndex === before - 1 && before < MAIN_TRACK_COUNT) {
          Save.unlockUpTo(before + 1);
          unlockedNew = true;
        }
      }
      eventBus.emit(Events.RACE_FINISHED, {
        place: racer.finishPlace,
        total: this.racers.length,
        time: gameState.raceTime,
        newBest,
        unlockedNew,
        trackName: this.trackDef.name,
      });
    }
  }

  // --- Camera ----------------------------------------------------------------
  //
  // The camera orbits behind a SMOOTHED yaw (`camYaw`) that lags the kart's
  // heading with its own rotation damping. Decoupling the camera's facing from
  // the instantaneous heading filters out high-frequency steering wobble, so
  // small left/right corrections no longer whip the view around. Position is
  // damped separately. (three.js chase-cam best practice: damp position AND
  // rotation independently.)

  /** Camera target position for a given yaw, placed behind + above the kart. */
  computeCamTarget(out, yaw) {
    const p = this.player.mesh.position;
    return out.set(
      p.x + Math.sin(yaw) * CAMERA.DISTANCE,
      CAMERA.HEIGHT,
      p.z + Math.cos(yaw) * CAMERA.DISTANCE
    );
  }

  /** Frame-rate-independent angular damping toward a target angle (shortest arc). */
  static dampAngle(current, target, t) {
    let diff = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return current + diff * t;
  }

  updateCamera(delta) {
    const p = this.player.mesh.position;

    // Damp the camera yaw toward the kart heading (filters micro-corrections).
    const yawT = 1 - Math.exp(-CAMERA.YAW_LERP * delta);
    this.camYaw = Game.dampAngle(this.camYaw, this.player.heading, yawT);

    // Damp position toward the target behind the smoothed yaw.
    this.computeCamTarget(this._camTarget, this.camYaw);
    const posT = 1 - Math.exp(-CAMERA.POS_LERP * delta);
    this.camera.position.lerp(this._camTarget, posT);

    // Look ahead along the SMOOTHED yaw (not the raw heading).
    this._lookTarget.set(
      p.x - Math.sin(this.camYaw) * CAMERA.LOOK_AHEAD,
      CAMERA.LOOK_OFFSET_Y,
      p.z - Math.cos(this.camYaw) * CAMERA.LOOK_AHEAD
    );
    this.camera.lookAt(this._lookTarget);

    // Speed-based FOV widening for a sense of velocity.
    const targetFov = FX.FOV_BASE + FX.FOV_MAX_ADD * Math.min(1, Math.max(0, this.player.speed) / KART.MAX_SPEED);
    const fovT = 1 - Math.exp(-FX.FOV_LERP * delta);
    this.camera.fov += (targetFov - this.camera.fov) * fovT;
    this.camera.updateProjectionMatrix();
  }

  snapCameraToKart() {
    this.camYaw = this.player.heading;
    this.computeCamTarget(this._camTarget, this.camYaw);
    this.camera.position.copy(this._camTarget);
    const p = this.player.mesh.position;
    this.camera.lookAt(
      p.x - Math.sin(this.camYaw) * CAMERA.LOOK_AHEAD,
      CAMERA.LOOK_OFFSET_Y,
      p.z - Math.cos(this.camYaw) * CAMERA.LOOK_AHEAD
    );
  }

  // --- Test / inspection hooks ----------------------------------------------

  /** Place the kart at a loop progress + lateral offset (deterministic tests). */
  setKartPose(progress, offset = 0) {
    if (!this.player) return;
    const s = this.track.pointAt(progress);
    const heading = Math.atan2(-s.tan.x, -s.tan.z);
    this.player.setPose(
      { x: s.pos.x + s.normal.x * offset, z: s.pos.z + s.normal.z * offset },
      heading
    );
  }

  toText() {
    const k = this.player;
    const p = k ? k.mesh.position : null;
    return {
      started: gameState.started,
      finished: gameState.finished,
      track: this.trackDef ? this.trackDef.id : null,
      trackIndex: this.trackIndex,
      trackCount: TRACK_DEFS.length,
      countdown: +gameState.countdown.toFixed(2),
      racing: gameState.started && !gameState.finished && gameState.countdown <= 0,
      lap: gameState.lap,
      totalLaps: this.laps,
      gate: gameState.gate,
      onTrack: gameState.onTrack,
      progress: +gameState.progress.toFixed(3),
      offset: +gameState.offset.toFixed(2),
      raceTime: +gameState.raceTime.toFixed(2),
      speed: k ? +k.speed.toFixed(3) : 0,
      heading: k ? +k.heading.toFixed(3) : 0,
      drift: k ? { active: k.drifting, charge: +k.driftCharge.toFixed(3) } : null,
      boost: k ? +k.boostTimer.toFixed(3) : 0,
      position: gameState.position,
      totalRacers: this.racers.length,
      heldItem: this.racers[0] ? this.racers[0].heldItem : null,
      items: {
        boxes: this.items.boxes.filter((b) => b.active).length,
        projectiles: this.items.projectiles.length,
        hazards: this.items.hazards.length,
      },
      player: p ? { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) } : null,
      racers: this.racers.map((r) => ({
        isPlayer: r.isPlayer,
        lap: r.lapTracker.lap,
        progress: +r.lastProgress.toFixed(3),
        finished: r.finished,
        place: r.finishPlace,
        pos: r.position,
        x: +r.kart.mesh.position.x.toFixed(2),
        z: +r.kart.mesh.position.z.toFixed(2),
      })),
      input: { moveX: this.input.moveX, moveZ: this.input.moveZ },
    };
  }

  onResize() {
    this.updatePixelation();
  }

  /** Render at a low internal resolution; CSS upscales the canvas with nearest. */
  updatePixelation() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const lw = Math.max(1, Math.floor(w * PS2.RES_SCALE));
    const lh = Math.max(1, Math.floor(h * PS2.RES_SCALE));
    this.renderer.setSize(lw, lh, false); // false = don't touch canvas CSS size
    if (this.composer) this.composer.setSize(lw, lh);
    if (this.bloom) this.bloom.setSize(lw, lh);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
