import * as THREE from 'three';
import { ENV, COLORS, ENV_PRESETS } from '../core/Constants.js';

/** Tiny seeded RNG (sin-hash) so the sky layout is stable across reloads. */
function seeded(n) { return ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1; }

/**
 * A gradient sky dome (vertical blend from horizon to zenith). Springs/highway
 * envs add soft low-poly clouds + a warm sun disc; the space env swaps those
 * for a starfield and a distant planet. Driven entirely by the track theme.
 */
export class Sky {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme || {};
    this.t = 0;
    this.buildDome();
    if (this.theme.starfield) this.buildStars();
    if (this.theme.planet != null) this.buildPlanet();
    if (!this.theme.sunless) this.buildSun();
    if (!this.theme.starfield) this.buildClouds();
  }

  buildSun() {
    // A bright additive glow disc placed toward the sun; bloom flares it.
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,245,1)');
    g.addColorStop(0.25, 'rgba(255,240,200,0.9)');
    g.addColorStop(0.6, 'rgba(255,200,120,0.35)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({
      map: tex, color: 0xffffff, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, fog: false, transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    const dir = new THREE.Vector3(...ENV.SUN_POSITION).normalize().multiplyScalar(440);
    sprite.position.copy(dir);
    sprite.scale.setScalar(ENV.SUN_SPRITE_SIZE);
    sprite.renderOrder = 1;
    sprite.userData.noPS2 = true;
    this.scene.add(sprite);
    this.sun = sprite;
  }

  /** A field of bright points on a large sphere — the deep-space backdrop. */
  buildStars() {
    const p = ENV_PRESETS.space;
    const count = p.starCount;
    const r = p.starRadius;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Even-ish spherical scatter (upper hemisphere biased) from a seeded hash.
      const u = seeded(i + 1) * 2 - 1;
      const a = seeded(i + 101) * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(a) * s * r;
      positions[i * 3 + 1] = Math.abs(u) * r * 0.9 + 20; // keep stars above the floor
      positions[i * 3 + 2] = Math.sin(a) * s * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.4, sizeAttenuation: false, fog: false,
      transparent: true, opacity: 0.95, depthWrite: false,
    });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = -1;
    stars.userData.noPS2 = true;
    this.scene.add(stars);
    this.stars = stars;
  }

  /** A distant glowing planet disc to anchor the space sky. */
  buildPlanet() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const col = new THREE.Color(this.theme.planet);
    const hex = (m) => Math.round(m * 255);
    const g = ctx.createRadialGradient(size * 0.42, size * 0.40, size * 0.05, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${hex(col.r)},${hex(col.g)},${hex(col.b)},1)`);
    g.addColorStop(0.55, `rgba(${hex(col.r * 0.7)},${hex(col.g * 0.7)},${hex(col.b * 0.8)},1)`);
    g.addColorStop(0.92, `rgba(${hex(col.r * 0.25)},${hex(col.g * 0.25)},${hex(col.b * 0.35)},1)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(-260, 150, -420);
    sprite.scale.setScalar(180);
    sprite.renderOrder = 0;
    sprite.userData.noPS2 = true;
    this.scene.add(sprite);
    this.planet = sprite;
  }

  buildDome() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(this.theme.skyTop ?? ENV.SKY_TOP) },
        mid: { value: new THREE.Color(this.theme.skyMid ?? ENV.SKY_MID) },
        horizon: { value: new THREE.Color(this.theme.skyHorizon ?? ENV.SKY_HORIZON) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 horizon;
        varying vec3 vWorld;

        // 4x4 ordered (Bayer) dither threshold — GLSL1-safe (no dynamic indexing).
        float bayer4x4(vec2 p) {
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          if (i==0) return 0.0/16.0;  if (i==1) return 8.0/16.0;  if (i==2) return 2.0/16.0;  if (i==3) return 10.0/16.0;
          if (i==4) return 12.0/16.0; if (i==5) return 4.0/16.0;  if (i==6) return 14.0/16.0; if (i==7) return 6.0/16.0;
          if (i==8) return 3.0/16.0;  if (i==9) return 11.0/16.0; if (i==10) return 1.0/16.0; if (i==11) return 9.0/16.0;
          if (i==12) return 15.0/16.0;if (i==13) return 7.0/16.0; if (i==14) return 13.0/16.0;
          return 5.0/16.0;
        }

        void main() {
          float h = clamp(normalize(vWorld).y * 1.25 + 0.08, 0.0, 1.0);
          // Posterize into bands with Bayer dithering — the PS2/PS1 banded sky.
          float bands = 16.0;
          float d = (bayer4x4(gl_FragCoord.xy) - 0.5) / bands;
          h = floor((h + d) * bands) / bands;
          // Warm 3-stop gradient: orange horizon -> gold band -> blue zenith.
          vec3 col = h < 0.45
            ? mix(horizon, mid, h / 0.45)
            : mix(mid, top, (h - 0.45) / 0.55);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -2;
    dome.userData.noPS2 = true;
    this.scene.add(dome);
    this.dome = dome;
  }

  buildClouds() {
    // One instanced flattened blob mesh; each cloud is a cluster created by
    // scattering a few instances. Cheap and reads as puffy low-poly clouds.
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({
      color: COLORS.STEAM, emissive: 0x8899aa, emissiveIntensity: 0.15, fog: false,
    });
    const blobsPerCloud = 5;
    const count = ENV.CLOUD_COUNT * blobsPerCloud;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let i = 0;
    // Deterministic-ish scatter (seeded by index) — avoids Math.random (banned).
    const rand = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let c = 0; c < ENV.CLOUD_COUNT; c++) {
      const ang = (c / ENV.CLOUD_COUNT) * Math.PI * 2;
      const radius = 180 + Math.abs(rand(c)) * 160;
      const cx = Math.cos(ang) * radius;
      const cz = Math.sin(ang) * radius;
      const cy = 80 + Math.abs(rand(c + 99)) * 60;
      for (let b = 0; b < blobsPerCloud; b++) {
        const s = 6 + Math.abs(rand(i + 7)) * 7;
        pos.set(cx + (rand(i + 1)) * 14, cy + (rand(i + 2)) * 4, cz + (rand(i + 3)) * 14);
        scl.set(s, s * 0.6, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.noPS2 = true;
    this.scene.add(mesh);
    this.clouds = mesh;
  }

  update(delta) {
    // Drift the whole cloud field slowly for subtle life.
    this.t += delta;
    if (this.clouds) this.clouds.rotation.y = this.t * 0.005;
    if (this.stars) this.stars.rotation.y = this.t * 0.003;
  }
}
