import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Track } from '../level/Track.js';
import { Sky } from '../level/Sky.js';
import { LevelBuilder } from '../level/LevelBuilder.js';
import { Scenery } from '../level/Scenery.js';
import { Kart } from '../gameplay/Kart.js';
import { gridPose } from '../gameplay/grid.js';
import { disposeObject3D } from '../core/disposeUtils.js';
import { COLORS, AI, KART, RIVAL_ROSTER, LEVEL, BLOOM } from '../core/Constants.js';

/**
 * Render REAL 3D previews of each track for the menu cards — framed like the live
 * menu background: the kart grid on the start line with that track's actual world
 * (ground, lighting, circuit, sky, GLB scenery) behind it, lit + bloomed like the
 * game. The 6 karts are built once and re-posed onto each track's start grid; only
 * the per-track environment is rebuilt and freed between shots. One temporary
 * renderer does them all and is then disposed.
 */
export function renderTrackThumbnails(defs, assets = {}, w = 640, h = 384) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (e) {
    console.warn('Track thumbnails unavailable (no WebGL context):', e);
    return defs.map(() => null);
  }

  const scene = new THREE.Scene();
  const karts = buildKarts(scene, assets);
  const camera = new THREE.PerspectiveCamera(46, w / h, 0.3, 3000);

  const composer = new EffectComposer(renderer);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), BLOOM.STRENGTH, BLOOM.RADIUS, BLOOM.THRESHOLD));

  const urls = defs.map((def) => {
    const env = new THREE.Group();
    scene.add(env);
    const theme = { ...def.theme, env: def.env || 'springs' };
    const level = new LevelBuilder(env, theme);
    const track = new Track(env, def);
    new Sky(env, theme);
    if (assets.models) {
      try { new Scenery(env, track, assets.models, theme); } catch (e) { /* skip dressing */ }
    }
    if (level.sun) level.sun.shadow.mapSize.set(1024, 1024);
    // Fog lives on the Scene (not a Group); push it back so the shot stays clear.
    scene.fog = new THREE.Fog(def.theme.fog ?? LEVEL.FOG_COLOR, 120, 520);

    poseGrid(karts, track);
    frameGrid(camera, track);
    renderer.setClearColor(def.theme.skyHorizon ?? 0x9fc6ef, 1);

    let url = null;
    try {
      composer.render();
      url = renderer.domElement.toDataURL('image/png');
    } catch (e) { /* capture failed */ }

    scene.remove(env);
    disposeObject3D(env);
    return url;
  });

  disposeObject3D(scene); // frees the karts (shared GLB resources are skipped)
  composer.dispose?.();
  renderer.dispose();
  if (renderer.forceContextLoss) renderer.forceContextLoss();
  return urls;
}

/** Build the 6-kart grid once (player capybara + 5 cute-animal rivals on go-karts). */
function buildKarts(scene, assets) {
  const karts = [];
  for (let i = 0; i < AI.COUNT + 1; i++) {
    const isPlayer = i === 0;
    const color = isPlayer ? COLORS.KART_BODY : AI.RIVAL_COLORS[(i - 1) % AI.RIVAL_COLORS.length];
    const kart = new Kart(scene, color);
    if (assets.kartGltf) {
      kart.setKartModel(assets.kartGltf, { yaw: KART.MODEL_YAW, length: KART.MODEL_LENGTH, yOffset: KART.MODEL_Y });
    }
    if (isPlayer) {
      if (assets.capyGltf) kart.setRider(assets.capyGltf, assets.orangeGltf);
    } else {
      const g = assets.rivalGltfs && assets.rivalGltfs[(i - 1) % RIVAL_ROSTER.length];
      if (g) kart.setAnimalRider(g, RIVAL_ROSTER[(i - 1) % RIVAL_ROSTER.length]);
      else if (assets.capyGltf) kart.setRider(assets.capyGltf, assets.orangeGltf);
    }
    karts.push(kart);
  }
  return karts;
}

/** Place the karts on a track's start grid (shared with the live race grid). */
function poseGrid(karts, track) {
  karts.forEach((kart, i) => {
    const pose = gridPose(track, i);
    kart.setPose(pose.position, pose.heading);
  });
}

/** Camera: a 3/4 front angle on the grid, like the live menu orbit (paused). */
function frameGrid(camera, track) {
  const s = track.samples[0];
  // Look at the middle of the grid (a bit behind the start line).
  const back = AI.GRID_START_BACK + AI.GRID_ROW_GAP * 0.8;
  const fx = s.pos.x - s.tan.x * back;
  const fz = s.pos.z - s.tan.z * back;
  // Forward unit (the way the karts face) + a lateral offset for the 3/4 angle.
  const fwdx = -s.tan.x, fwdz = -s.tan.z;
  const rightx = -s.tan.z, rightz = s.tan.x;
  const ahead = 13, side = 9, up = 6.2;
  camera.position.set(fx + fwdx * ahead + rightx * side, up, fz + fwdz * ahead + rightz * side);
  camera.lookAt(fx, 1.5, fz);
  camera.updateProjectionMatrix();
}
