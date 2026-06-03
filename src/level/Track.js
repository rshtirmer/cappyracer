import * as THREE from 'three';
import { TRACK, COLORS, PS2 } from '../core/Constants.js';
import { loadAsphaltTexture } from './Textures.js';

/** Orange banner texture with centered bold text for the start/finish gantry. */
function makeBannerTexture(text) {
  const w = 1536;
  const h = 96;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // Orange background with a thin trim border.
  ctx.fillStyle = '#e07f1e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b85f12';
  ctx.fillRect(0, 0, w, 8);
  ctx.fillRect(0, h - 8, w, 8);
  // Centered bold white text with a dark outline.
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#7a3d08';
  ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = '#fff8e8';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/**
 * A closed-loop circuit. The centerline is a closed CatmullRom curve through
 * the control points, sampled into evenly-spaced points with tangents and
 * lateral normals. Provides geometry queries used for off-track detection,
 * wall clamping, lap progress, and kart spawning.
 */
export class Track {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def || null;
    this.theme = (def && def.theme) || {};
    // Per-track width override (e.g. the wide multi-lane highway).
    this.roadHalf = (def && def.roadHalf) || TRACK.ROAD_HALF_WIDTH;
    this.wallHalf = (def && def.wallHalf) || TRACK.WALL_HALF_WIDTH;

    const points = (def && def.controlPoints) || TRACK.CONTROL_POINTS;
    this.curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,            // closed
      'catmullrom',
      0.5
    );

    this.samples = this.buildSamples(TRACK.SAMPLES);
    this.group = new THREE.Group();
    this.buildRoad();
    this.buildEdgeLines();
    this.buildLaneLines();
    this.buildCurbs();
    this.buildStartLine();
    this.buildBarriers();
    this.buildGantry();
    scene.add(this.group);

    // Spawn pose: on the start line, facing along the tangent.
    const s0 = this.samples[0];
    this.startPose = {
      position: new THREE.Vector3(s0.pos.x, 0, s0.pos.z),
      heading: Math.atan2(-s0.tan.x, -s0.tan.z),
    };

    this._tmp = new THREE.Vector3();
  }

  // --- Sampling --------------------------------------------------------------

  buildSamples(n) {
    const samples = [];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const pos = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).normalize();
      // Left-hand lateral normal in the XZ plane.
      const normal = new THREE.Vector3(-tan.z, 0, tan.x);
      samples.push({ pos, tan, normal });
    }
    return samples;
  }

  // --- Queries ---------------------------------------------------------------

  /**
   * Map a world position to { progress (0..1), offset (signed lateral, +left),
   * index }. Nearest-centerline-sample search.
   */
  locate(position) {
    const n = this.samples.length;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const p = this.samples[i].pos;
      const dx = position.x - p.x;
      const dz = position.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    const s = this.samples[best];
    this._tmp.set(position.x - s.pos.x, 0, position.z - s.pos.z);
    const offset = this._tmp.dot(s.normal);
    return { progress: best / n, offset, index: best };
  }

  /** Centerline world position at a given progress (0..1) — snapped to a sample. */
  pointAt(progress) {
    const n = this.samples.length;
    const i = ((Math.round(progress * n) % n) + n) % n;
    return this.samples[i];
  }

  /**
   * Smooth centerline query: linearly interpolates pos/tan/normal BETWEEN the two
   * nearest samples instead of snapping to one. Continuously-moving things (the
   * highway traffic) must use this — snapping to one of 420 discrete points makes
   * a slow car visibly teleport/stutter between samples each frame. Returns a
   * lightweight {pos, tan, normal} of plain {x, z} (callers only read x/z).
   */
  pointAtSmooth(progress) {
    const n = this.samples.length;
    const f = (((progress % 1) + 1) % 1) * n;
    const i0 = Math.floor(f) % n;
    const i1 = (i0 + 1) % n;
    const t = f - Math.floor(f);
    const a = this.samples[i0];
    const b = this.samples[i1];
    const lerp = (u, v) => u + (v - u) * t;
    return {
      pos: { x: lerp(a.pos.x, b.pos.x), z: lerp(a.pos.z, b.pos.z) },
      tan: { x: lerp(a.tan.x, b.tan.x), z: lerp(a.tan.z, b.tan.z) },
      normal: { x: lerp(a.normal.x, b.normal.x), z: lerp(a.normal.z, b.normal.z) },
    };
  }

  // --- Geometry --------------------------------------------------------------

  buildRoad() {
    const n = this.samples.length;
    const positions = [];
    const uvs = [];
    const indices = [];
    const uW = (this.roadHalf * 2) / 3; // ~3-unit tiles across the road width
    for (let i = 0; i < n; i++) {
      const { pos, normal } = this.samples[i];
      const lx = pos.x + normal.x * this.roadHalf;
      const lz = pos.z + normal.z * this.roadHalf;
      const rx = pos.x - normal.x * this.roadHalf;
      const rz = pos.z - normal.z * this.roadHalf;
      positions.push(lx, 0.05, lz, rx, 0.05, rz);
      const v = i / PS2.ASPHALT_TILE;
      uvs.push(0, v, uW, v);
    }
    for (let i = 0; i < n; i++) {
      const a = 2 * i;
      const b = 2 * i + 1;
      const ni = (i + 1) % n;
      const c = 2 * ni;
      const d = 2 * ni + 1;
      indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const asphalt = loadAsphaltTexture();
    // theme.roadColor tints the asphalt (dark void road in space, gray highway).
    const mat = new THREE.MeshLambertMaterial({
      map: asphalt, color: this.theme.roadColor ?? 0xffffff,
      emissive: this.theme.roadEmissive ?? 0x000000,
      emissiveIntensity: this.theme.roadEmissive ? 0.5 : 0,
      side: THREE.DoubleSide,
    });
    const road = new THREE.Mesh(geo, mat);
    road.receiveShadow = true;
    road.userData.noPS2 = true; // keep the road surface stable (no wobble gaps at edges)
    this.group.add(road);
  }

  buildEdgeLines() {
    // theme.edgeColor lets a track glow its lines (neon cyan in space) — bloom
    // flares the bright unlit color for that arcade look.
    const mat = new THREE.MeshBasicMaterial({ color: this.theme.edgeColor ?? COLORS.EDGE_LINE, side: THREE.DoubleSide });
    for (const sign of [1, -1]) {
      const outer = this.roadHalf;
      const inner = this.roadHalf - 0.5;
      const n = this.samples.length;
      const positions = [];
      const indices = [];
      for (let i = 0; i < n; i++) {
        const { pos, normal } = this.samples[i];
        const ox = pos.x + sign * normal.x * outer;
        const oz = pos.z + sign * normal.z * outer;
        const ix = pos.x + sign * normal.x * inner;
        const iz = pos.z + sign * normal.z * inner;
        positions.push(ox, 0.08, oz, ix, 0.08, iz);
      }
      for (let i = 0; i < n; i++) {
        const a = 2 * i, b = 2 * i + 1, ni = (i + 1) % n, c = 2 * ni, d = 2 * ni + 1;
        indices.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      const line = new THREE.Mesh(geo, mat);
      line.userData.noPS2 = true;
      this.group.add(line);
    }
  }

  /**
   * Dashed white lane dividers down the road (highway only — theme.laneDividers
   * holds the lateral offsets). One merged geometry of short quads following the
   * centerline; the dash pattern tiles the 420 samples exactly so there's no seam.
   */
  buildLaneLines() {
    const dividers = this.theme.laneDividers;
    if (!dividers || !dividers.length) return;
    const n = this.samples.length;
    const HALF_W = 0.16;     // line half-width
    const DASH = 4, GAP = 8; // samples on/off (420 / 12 = 35 dashes per lane, no seam)
    const half = HALF_W;
    const positions = [];
    const indices = [];
    let v = 0;
    for (const off of dividers) {
      for (let i = 0; i < n; i++) {
        if ((i % (DASH + GAP)) >= DASH) continue;
        const a = this.samples[i];
        const b = this.samples[(i + 1) % n];
        const ax = a.pos.x + a.normal.x * off, az = a.pos.z + a.normal.z * off;
        const bx = b.pos.x + b.normal.x * off, bz = b.pos.z + b.normal.z * off;
        positions.push(
          ax + a.normal.x * half, 0.07, az + a.normal.z * half,
          ax - a.normal.x * half, 0.07, az - a.normal.z * half,
          bx + b.normal.x * half, 0.07, bz + b.normal.z * half,
          bx - b.normal.x * half, 0.07, bz - b.normal.z * half,
        );
        indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 4;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf4f4f4, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.noPS2 = true;
    this.group.add(mesh);
  }

  buildCurbs() {
    // Alternating red/white curb segments just outside each edge line. One
    // InstancedMesh (per-instance color) keeps it to a single draw call.
    const n = this.samples.length;
    const geo = new THREE.BoxGeometry(1.0, 0.14, 1.15);
    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, n * 2);
    mesh.receiveShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 2 * 3), 3);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const { pos, normal, tan } = this.samples[i];
      const yaw = Math.atan2(tan.x, tan.z);
      e.set(0, yaw, 0);
      q.setFromEuler(e);
      const stripe = Math.floor(i / 3) % 2 === 0;
      for (const sign of [1, -1]) {
        const off = this.roadHalf + 0.55;
        p.set(pos.x + sign * normal.x * off, 0.12, pos.z + sign * normal.z * off);
        m.compose(p, q, s);
        mesh.setMatrixAt(idx, m);
        color.set(stripe ? COLORS.CURB_A : COLORS.CURB_B);
        mesh.setColorAt(idx, color);
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  buildGantry() {
    // Start/finish arch: two posts + an overhead banner beam across the road.
    // Everything placed in world space (no group rotation) to avoid surprises.
    const s = this.samples[0];
    const postMat = new THREE.MeshLambertMaterial({ color: COLORS.GANTRY });
    const bannerTex = makeBannerTexture((this.def && this.def.name ? this.def.name : "Cappy's Course").toUpperCase());
    const beamMat = new THREE.MeshLambertMaterial({
      map: bannerTex, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.3,
    });
    const span = this.roadHalf * 2 + 3;
    const height = 6.5;

    const postGeo = new THREE.BoxGeometry(0.5, height, 0.5);
    for (const sign of [1, -1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(
        s.pos.x + sign * s.normal.x * (span / 2),
        height / 2,
        s.pos.z + sign * s.normal.z * (span / 2)
      );
      post.castShadow = true;
      this.group.add(post);
    }

    const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 1.2, 0.6), beamMat);
    beam.position.set(s.pos.x, height, s.pos.z);
    // Align the beam's long (local X) axis with the lateral normal.
    beam.rotation.y = Math.atan2(-s.normal.z, s.normal.x);
    beam.castShadow = true;
    this.group.add(beam);
  }

  buildStartLine() {
    // Checkered band across the road at sample 0.
    const s = this.samples[0];
    const cells = 10;
    const depthRows = 2;
    const cellW = (this.roadHalf * 2) / cells;
    const cellGeo = new THREE.PlaneGeometry(cellW, cellW);
    for (let row = 0; row < depthRows; row++) {
      for (let c = 0; c < cells; c++) {
        const dark = (row + c) % 2 === 0;
        const mat = new THREE.MeshBasicMaterial({
          color: dark ? COLORS.START_DARK : COLORS.START_LIGHT,
          side: THREE.DoubleSide,
        });
        const lateral = -this.roadHalf + cellW * (c + 0.5);
        const along = (row - (depthRows - 1) / 2) * cellW;
        const x = s.pos.x + s.normal.x * lateral + s.tan.x * along;
        const z = s.pos.z + s.normal.z * lateral + s.tan.z * along;
        const cell = new THREE.Mesh(cellGeo, mat);
        cell.rotation.x = -Math.PI / 2;
        cell.rotation.z = -Math.atan2(s.tan.x, s.tan.z);
        cell.position.set(x, 0.1, z);
        cell.userData.noPS2 = true;
        this.group.add(cell);
      }
    }
  }

  buildBarriers() {
    // Alternating red/white posts along both walls, as one InstancedMesh.
    const n = this.samples.length;
    const step = 7;
    const slots = [];
    let k = 0;
    for (let i = 0; i < n; i += step) {
      for (const sign of [1, -1]) slots.push({ i, sign, stripe: k % 2 === 0 });
      k++;
    }
    const geo = new THREE.BoxGeometry(0.5, 1.0, 0.5);
    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    mesh.castShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(slots.length * 3), 3);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();
    slots.forEach((slot, idx) => {
      const { pos, normal } = this.samples[slot.i];
      p.set(
        pos.x + slot.sign * normal.x * (this.wallHalf + 0.4),
        0.5,
        pos.z + slot.sign * normal.z * (this.wallHalf + 0.4)
      );
      m.compose(p, q, s);
      mesh.setMatrixAt(idx, m);
      color.set(slot.stripe ? COLORS.BARRIER_A : COLORS.BARRIER_B);
      mesh.setColorAt(idx, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }
}
