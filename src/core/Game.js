import * as THREE from 'three';
import { GAME, CAMERA, COLORS, TRACK, RACE, KART, FX, MODELS, RIVAL_ROSTER, PS2, BLOOM, AI, LEVEL } from './Constants.js';
import { Save } from './Save.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { eventBus, Events } from './EventBus.js';
import { gameState } from './GameState.js';
import { disposeObject3D } from './disposeUtils.js';
import { InputSystem } from '../systems/InputSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
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
import { Cutscene } from '../ui/Cutscene.js';
import { PRE_RACE, WIN_BEAT, BEATS, HERO } from '../story/story.js';

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

    // Survive a GPU context loss (tab backgrounded, driver reset, low-end mobile):
    // preventDefault lets the browser restore the context, after which three.js
    // re-uploads buffers/textures lazily on the next render. Without this the
    // canvas goes permanently black.
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost — pausing render until restored.');
      this._contextLost = true;
    }, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.warn('WebGL context restored.');
      this._contextLost = false;
    }, false);

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
    this.audio = new AudioSystem(); // procedural Web Audio (engine/SFX/music)
    this.hud = new HUD();
    this.menu = new Menu();
    // In-engine cinematics. Focus follows the player kart (start line until spawned).
    this.cutscene = new Cutscene(
      this.camera,
      () => (this.player ? this.player.mesh.position : this.track.startPose.position)
    );
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
    this.rivalGltfs = null; // [duck, cat, frog, tortoise, hedgehog] aligned to RIVAL_ROSTER
    this.kartGltf = null;   // the kart vehicle GLB (shared by all racers)
    this.trophyGltf = null; // the Cup trophy (finale cinematic prop)
    this.trafficGltfs = null; // [sedan, hatch] highway traffic cars
    this.cutsceneProp = null; // active cinematic prop (e.g. the trophy)
    this.assets = new AssetLoader();
    // Every asset load is individually resilient: a 404 / parse failure resolves
    // to null instead of rejecting the whole batch. Downstream code already
    // null-guards (primitive kart, capybara-fallback rider, scenery skips a
    // missing model), so a bad asset degrades gracefully instead of leaving the
    // title screen empty with only a console.error.
    const tryLoad = (url) => this.assets.load(url).catch((e) => {
      console.warn('Asset failed to load:', url, e);
      return null;
    });
    Promise.all([
      tryLoad(MODELS.CAPYBARA),
      tryLoad(MODELS.ORANGE),
      tryLoad(MODELS.TREE1),
      tryLoad(MODELS.TREE2),
      tryLoad(MODELS.ROCK),
      tryLoad(MODELS.BARREL),
      tryLoad(MODELS.CRATE),
      tryLoad(MODELS.BARRICADE),
      // Rival riders (a failed one falls back to a capybara).
      ...RIVAL_ROSTER.map((r) => tryLoad(r.file)),
      // Kart vehicle (failure keeps the primitive kart).
      tryLoad(MODELS.KART),
      // Cup trophy for the finale cinematic.
      tryLoad(MODELS.TROPHY),
      // Highway traffic cars (failure falls back to primitive boxes).
      tryLoad(MODELS.TRAFFIC_SEDAN),
      tryLoad(MODELS.TRAFFIC_HATCH),
    ])
      .then((all) => {
        const [capy, orange, tree1, tree2, rock, barrel, crate, barricade] = all;
        this.capyGltf = capy;
        this.orangeGltf = orange;
        if (this.items) this.items.setYuzu(orange); // yuzu projectile model
        this.rivalGltfs = all.slice(8, 13); // the 5 rivals, in roster order
        this.kartGltf = all[13];
        this.trophyGltf = all[14];
        this.trafficGltfs = [all[15], all[16]]; // [sedan, hatch]
        this.models = { tree1, tree2, rock, barrel, crate, barricade };
        this.modelsLoaded = true;
        this.buildScenery();
        if (this.traffic) this.rebuildTraffic(); // swap box fallback -> GLB cars
        if (this.racers.length) { this.attachRiders(); this.applyKarts(); }
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
    // Story-aware PLAY: play the track's intro beat (once) before racing.
    eventBus.on(Events.RACE_REQUESTED, () => this.onRaceRequested());
    // Finish-screen "Continue": play a beat (e.g. a win beat) then back to menu.
    eventBus.on(Events.CUTSCENE_PLAY, (id) => this.playBeat(id, () => this.restart()));
    // Cinematic props: reveal the Cup trophy during the finale beat.
    eventBus.on(Events.CUTSCENE_START, (id) => { if (BEATS[id] && BEATS[id].prop === 'trophy') this.spawnTrophyProp(); });
    eventBus.on(Events.CUTSCENE_END, () => this.clearCutsceneProp());

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
    if (this.orangeGltf) this.items.setYuzu(this.orangeGltf);
    this.sky = new Sky(this.worldGroup, theme);
    // Highway "no-hesi" traffic to weave through (bonus track only).
    this.traffic = def.env === 'highway'
      ? new Traffic(this.worldGroup, this.track, this.trafficGltfs)
      : null;
    this.scene.fog = new THREE.Fog(def.theme.fog ?? LEVEL.FOG_COLOR, LEVEL.FOG_NEAR, LEVEL.FOG_FAR);
    if (this.modelsLoaded) this.buildScenery();
    applyVertexSnapToScene(this.worldGroup, PS2.VERTEX_SNAP);
  }

  /** Swap the box-fallback traffic for the real GLB cars once they've loaded. */
  rebuildTraffic() {
    if (!this.traffic || !this.worldGroup) return;
    if (!this.traffic.boxMode) return; // already on GLB cars
    this.traffic.dispose();
    this.traffic = new Traffic(this.worldGroup, this.track, this.trafficGltfs);
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
    // Frees per-build geometry/materials/textures (grass, asphalt, banner, sun,
    // planet, item box "?", boost pads, hot-spring/crystal mats). Scenery's
    // instanced GLB materials are flagged shared and skipped — they belong to the
    // persistent model gltfs and are reused on the next build.
    disposeObject3D(this.worldGroup);
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

  /** PLAY pressed: if this track has an unseen intro beat, play it then race. */
  onRaceRequested() {
    const beatId = PRE_RACE[this.trackDef.id];
    if (beatId && BEATS[beatId] && !Save.hasSeenBeat(beatId) && !this.cutscene.playing) {
      this.playBeat(beatId, () => this.startGame());
    } else {
      this.startGame();
    }
  }

  /** Play a story beat (in-engine cinematic), marking it seen when it ends. */
  playBeat(id, onDone) {
    const beat = BEATS[id];
    if (!beat) { if (onDone) onDone(); return; }
    this.menu.hideAll();
    this.cutscene.play(beat, () => {
      Save.markBeatSeen(id);
      if (onDone) onDone();
    });
  }

  /** Reveal the glowing Cup trophy above the capybara during the finale beat. */
  spawnTrophyProp() {
    if (!this.trophyGltf || this.cutsceneProp) return;
    const model = this.trophyGltf.scene.clone(true);
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const s = 2.4 / (size.y || 1);
    model.scale.setScalar(s);
    model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      const tint = (m) => { const c = m.clone(); c.emissive = new THREE.Color(0xffcc33); c.emissiveIntensity = 0.55; return c; };
      o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
    });
    const group = new THREE.Group();
    group.add(model);
    const p = this.player ? this.player.mesh.position : this.track.startPose.position;
    group.position.set(p.x, p.y + 2.7, p.z);
    group.userData.baseY = group.position.y;
    group.userData.noPS2 = true;
    this.scene.add(group);
    this.cutsceneProp = group;
  }

  clearCutsceneProp() {
    if (!this.cutsceneProp) return;
    this.scene.remove(this.cutsceneProp);
    // The trophy is a GLB clone: geometry + textures are SHARED with the
    // persistent trophyGltf, but spawnTrophyProp gave it freshly cloned (tinted)
    // materials. Dispose only those material objects — never the shared geometry
    // or the shared map textures (that would corrupt the next finale reveal).
    this.cutsceneProp.traverse((o) => {
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x && x.dispose && x.dispose());
    });
    this.cutsceneProp = null;
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
      const ai = isPlayer
        ? null
        : new AIController(AI.LANES[(i - 1) % AI.LANES.length], AI.SKILL[(i - 1) % AI.SKILL.length]);
      const racer = {
        kart, ai, lapTracker: new LapTracker(), lastProgress: 0, crossedStart: false,
        finished: false, finishPlace: 0, finishTime: 0, isPlayer, position: i + 1,
        heldItem: null, itemUseTimer: 0,
        name: isPlayer ? HERO : RIVAL_ROSTER[(i - 1) % RIVAL_ROSTER.length].name,
      };
      this.racers.push(racer);
      this.attachRiderFor(racer, i);
      this.applyKartFor(racer.kart);
    }
    this.player = this.racers[0].kart;
    this.player.isPlayerKart = true; // gates player-only SFX (boost whoosh, etc.)
  }

  /** Swap a kart onto the shared kart GLB (no-op until it's loaded). */
  applyKartFor(kart) {
    if (this.kartGltf) {
      kart.setKartModel(this.kartGltf, { yaw: KART.MODEL_YAW, length: KART.MODEL_LENGTH, yOffset: KART.MODEL_Y });
    }
  }

  applyKarts() {
    for (const r of this.racers) this.applyKartFor(r.kart);
  }

  /**
   * Attach the right rider to a racer: the capybara (+ head orange) for the
   * player, the mapped cute-animal for each AI rival. No-ops until models load.
   */
  attachRiderFor(racer, i) {
    if (!this.capyGltf) return;
    if (racer.isPlayer) { racer.kart.setRider(this.capyGltf, this.orangeGltf); return; }
    const idx = (i - 1) % RIVAL_ROSTER.length;
    const gltf = this.rivalGltfs && this.rivalGltfs[idx];
    if (gltf) racer.kart.setAnimalRider(gltf, RIVAL_ROSTER[idx]);
    else racer.kart.setRider(this.capyGltf, this.orangeGltf); // fallback
  }

  attachRiders() {
    this.racers.forEach((r, i) => this.attachRiderFor(r, i));
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
    if (this._contextLost) return; // GPU context gone; skip the draw until restored
    this.composer.render();
  }

  /** Advance the simulation by `delta` seconds (driven by animate + advanceTime). */
  update(delta) {
    this.input.update();
    this.audio.update(); // engine pitch + drift whine + countdown + music scheduler

    // Ambient world life runs even on the menu.
    this.sky.update(delta);
    if (this.scenery) this.scenery.emitSteam(this.particles, delta, FX.STEAM_RATE);
    this.particles.update(delta);
    // Highway traffic circulates always; only clips the player while racing.
    if (this.traffic) {
      const racing = gameState.started && !gameState.finished && gameState.countdown <= 0;
      this.traffic.update(delta, this.racers, racing);
    }

    // Cinematic takes over the camera + freezes race/menu logic while playing.
    if (this.cutscene.playing) {
      this.idleRiders(delta);
      this.cutscene.update(delta);
      if (this.cutsceneProp) {
        this.cutsceneProp.rotation.y += delta * 0.9; // turntable the Cup
        this.cutsceneProp.position.y = this.cutsceneProp.userData.baseY + Math.sin(this.cutscene.shotT * 2) * 0.12;
      }
      return;
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
      if (racer.ai) racer.ai.capSpeed(racer.kart, racer.rubber || 1);
      this.updateRacerTrack(racer, delta);
    }

    // Items: player fires/uses on input; the system handles AI use + effects.
    const player = this.racers[0];
    if (this.input.consumeUse() && player.heldItem) this.items.useItem(player, this.racers);
    this.items.update(delta, this.racers);
    gameState.heldItem = player.heldItem;
    // The head orange IS the throwable yuzu — show it only while holding one.
    this.player.setHeldVisual(player.heldItem === 'shell');

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
      gameState.speed = kart.speed;          // engine-pitch source for audio
      gameState.drifting = kart.drifting;     // drift-charge whine source
      gameState.driftCharge = kart.driftCharge;
      if (completed && !racer.finished) {
        eventBus.emit(Events.LAP_COMPLETED, { lap: racer.lapTracker.lap, total: this.laps });
      }
    }
  }

  /**
   * Separate overlapping karts (circle-circle). A bump bleeds speed in PROPORTION
   * to how deep the overlap is — a graze barely slows you, a hard hit slows more —
   * plus a tiny extra separation push so two karts riding side-by-side knock apart
   * cleanly instead of velcro-sticking and draining speed every frame.
   */
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
        const depth = (r - d) / r;                 // 0 (grazing) .. 1 (concentric)
        const push = (r - d) / 2 + AI.COLLIDE_BIAS; // fully separate + small pop
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        const bleed = 1 - AI.COLLIDE_BLEED * depth; // gentle, depth-scaled
        this.racers[i].kart.speed *= bleed;
        this.racers[j].kart.speed *= bleed;
      }
    }
  }

  /** Rank racers by lap + progress; record the player's live position + rubber-band. */
  updatePositions() {
    const ranked = this.racers
      .map((r) => ({ r, p: r.lapTracker.lap + r.lastProgress - (r.crossedStart ? 0 : 1) }))
      .sort((x, y) => y.p - x.p);
    ranked.forEach((e, i) => { e.r.position = i + 1; });

    // Rubber-band each AI toward the player's race distance: behind -> faster,
    // ahead -> slower, scaled by the gap (keeps the field racing close).
    const pPlayer = this.racers[0].lapTracker.lap + this.racers[0].lastProgress
      - (this.racers[0].crossedStart ? 0 : 1);
    for (const e of ranked) {
      if (!e.r.ai) { e.r.rubber = 1; continue; }
      const gap = Math.max(-1, Math.min(1, (e.p - pPlayer) / AI.RUBBER_GAP));
      e.r.rubber = 1 - gap * AI.RUBBER_MAX; // gap>0 (ahead) slows; gap<0 (behind) speeds
    }

    gameState.position = this.racers[0].position;
    gameState.totalRacers = this.racers.length;
  }

  /**
   * Final standings snapshot at the moment the player crosses the line. Already
   * finished racers keep their place + time; racers still on track are projected
   * by lap + progress (so the results screen shows the full 1st–6th field).
   */
  buildStandings() {
    const prog = (r) => r.lapTracker.lap + r.lastProgress - (r.crossedStart ? 0 : 1);
    const ranked = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishPlace - b.finishPlace;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return prog(b) - prog(a);
    });
    return ranked.map((r, i) => ({
      place: i + 1,
      name: r.name,
      isPlayer: r.isPlayer,
      finished: r.finished,
      time: r.finished ? r.finishTime : null,
    }));
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
      // Winning a track plays its story beat (first time only).
      let winBeat = null;
      if (racer.finishPlace === 1) {
        const id = WIN_BEAT[this.trackDef.id];
        if (id && BEATS[id] && !Save.hasSeenBeat(id)) winBeat = id;
      }
      eventBus.emit(Events.RACE_FINISHED, {
        place: racer.finishPlace,
        total: this.racers.length,
        time: gameState.raceTime,
        newBest,
        unlockedNew,
        trackName: this.trackDef.name,
        winBeat,
        standings: this.buildStandings(),
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
