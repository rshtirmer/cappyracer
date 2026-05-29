import * as THREE from 'three';
import { LEVEL, COLORS, ENV, PS2 } from '../core/Constants.js';
import { makeGrassTexture } from './Textures.js';

/**
 * Builds the static environment: a big grass plane, lighting (hemisphere bounce
 * + a shadow-casting sun), and fog. The sky dome, scenery, and the race circuit
 * are built by Sky / Scenery / Track (added by Game).
 */
export class LevelBuilder {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme || {};
    this.buildGround();
    this.buildLighting();
    this.buildFog();
  }

  buildGround() {
    const geometry = new THREE.PlaneGeometry(LEVEL.GROUND_SIZE, LEVEL.GROUND_SIZE);
    const grass = makeGrassTexture();
    grass.repeat.set(PS2.GRASS_REPEAT, PS2.GRASS_REPEAT);
    // Push the ground back in the depth buffer so the road/curbs never z-fight
    // with it (which showed up as grass flickering through the track).
    // theme.ground tints the grass per track (white = unchanged).
    const material = new THREE.MeshLambertMaterial({
      map: grass, color: this.theme.ground ?? 0xffffff,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.noPS2 = true; // keep the big flat plane stable (no wobble)
    this.scene.add(this.ground);
  }

  buildLighting() {
    // Sky/ground bounce for soft, sunny ambient fill.
    const hemi = new THREE.HemisphereLight(ENV.HEMI_SKY, ENV.HEMI_GROUND, ENV.HEMI_INTENSITY);
    this.scene.add(hemi);

    // Warm sun that casts shadows across the track.
    const sun = new THREE.DirectionalLight(ENV.SUN_COLOR, ENV.SUN_INTENSITY);
    sun.position.set(...ENV.SUN_POSITION);
    sun.castShadow = true;
    sun.shadow.mapSize.set(ENV.SHADOW_MAP, ENV.SHADOW_MAP);
    const a = ENV.SHADOW_AREA;
    sun.shadow.camera.left = -a;
    sun.shadow.camera.right = a;
    sun.shadow.camera.top = a;
    sun.shadow.camera.bottom = -a;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  buildFog() {
    this.scene.fog = new THREE.Fog(this.theme.fog ?? LEVEL.FOG_COLOR, LEVEL.FOG_NEAR, LEVEL.FOG_FAR);
  }
}
