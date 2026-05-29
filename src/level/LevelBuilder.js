import * as THREE from 'three';
import { LEVEL, ENV, ENV_PRESETS, PS2 } from '../core/Constants.js';
import { makeGrassTexture } from './Textures.js';

/**
 * Builds the static environment: the ground plane, lighting (hemisphere bounce
 * + a shadow-casting key light), and fog. Lighting + ground material adapt to
 * the track's `env` ('springs' = warm sun, 'space' = cool dim void, 'highway' =
 * bright clear day). The sky dome, scenery, and circuit are built elsewhere.
 */
export class LevelBuilder {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme || {};
    this.env = this.theme.env || 'springs';
    this.preset = ENV_PRESETS[this.env] || null;
    this.buildGround();
    this.buildLighting();
    this.buildFog();
  }

  buildGround() {
    const geometry = new THREE.PlaneGeometry(LEVEL.GROUND_SIZE, LEVEL.GROUND_SIZE);
    let material;
    if (this.env === 'space') {
      // Smooth dark void floor (no grass) with a faint self-glow so karts read.
      material = new THREE.MeshLambertMaterial({
        color: this.theme.ground ?? 0x161229,
        emissive: 0x0a0820, emissiveIntensity: 0.4,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
    } else {
      // Grass (also roadside verge for the highway). theme.ground tints it.
      const grass = makeGrassTexture();
      grass.repeat.set(PS2.GRASS_REPEAT, PS2.GRASS_REPEAT);
      material = new THREE.MeshLambertMaterial({
        map: grass, color: this.theme.ground ?? 0xffffff,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
    }
    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.noPS2 = true; // keep the big flat plane stable (no wobble)
    this.scene.add(this.ground);
  }

  buildLighting() {
    const p = this.preset;
    // Sky/ground bounce for soft ambient fill (cool + dim in space, warm in springs).
    const hemi = new THREE.HemisphereLight(
      p ? p.hemiSky : ENV.HEMI_SKY,
      p ? p.hemiGround : ENV.HEMI_GROUND,
      p ? p.hemiIntensity : ENV.HEMI_INTENSITY
    );
    this.scene.add(hemi);

    // Key light that casts shadows across the track.
    const sun = new THREE.DirectionalLight(
      p ? p.sunColor : ENV.SUN_COLOR,
      p ? p.sunIntensity : ENV.SUN_INTENSITY
    );
    sun.position.set(...(p ? p.sunPos : ENV.SUN_POSITION));
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
