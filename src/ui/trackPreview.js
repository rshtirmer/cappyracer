import * as THREE from 'three';

/** 0xRRGGBB -> "#rrggbb". */
function css(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6); }

/** Deterministic 0..1 hash for stable star scatter. */
function seeded(n) { return ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1; }

/**
 * Draw a clean top-down preview of a track onto a 2D canvas: a themed sky
 * backdrop, the sampled centerline rendered as a road ribbon with a dashed
 * racing line, and a start/finish marker. Uses the SAME CatmullRom params as
 * the real Track so the silhouette matches what you actually drive.
 */
export function drawTrackPreview(canvas, def) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const theme = def.theme || {};
  const env = def.env || 'springs';

  ctx.clearRect(0, 0, W, H);

  // --- Backdrop ---------------------------------------------------------------
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(theme.skyTop ?? 0x5b8fd0));
  g.addColorStop(0.6, css(theme.skyMid ?? 0xffd9a3));
  g.addColorStop(1, css(theme.skyHorizon ?? 0xff9e5e));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (env === 'space') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 70; i++) {
      const x = seeded(i + 1) * W;
      const y = seeded(i + 50) * H;
      const s = seeded(i + 90) > 0.85 ? 1.8 : 0.9;
      ctx.fillRect(x, y, s, s);
    }
  }

  // --- Sample the centerline (matches Track.js) -------------------------------
  const curve = new THREE.CatmullRomCurve3(
    def.controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true, 'catmullrom', 0.5
  );
  const N = 180;
  const pts = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    pts.push([p.x, p.z]);
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }

  // Fit into the canvas with padding, preserving aspect ratio.
  const pad = 18;
  const spanX = (maxX - minX) || 1;
  const spanZ = (maxZ - minZ) || 1;
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ);
  const ox = (W - spanX * scale) / 2 - minX * scale;
  const oy = (H - spanZ * scale) / 2 - minZ * scale;
  const tx = (x) => ox + x * scale;
  const ty = (z) => oy + z * scale;

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(tx(pts[0][0]), ty(pts[0][1]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i][0]), ty(pts[i][1]));
    ctx.closePath();
  };

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Road casing (slightly darker, wider) for a crisp edge.
  const roadW = Math.max(7, ((def.roadHalf ?? 8) * 2) * scale * 0.55);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = roadW + 4;
  trace();
  ctx.stroke();

  // Road surface.
  ctx.strokeStyle = css(theme.roadColor && theme.roadColor !== 0xffffff ? theme.roadColor : 0x4a4f57);
  ctx.lineWidth = roadW;
  trace();
  ctx.stroke();

  // Dashed racing line down the middle (themed edge color).
  ctx.strokeStyle = css(theme.edgeColor ?? 0xffe14d);
  ctx.lineWidth = Math.max(1.2, roadW * 0.12);
  ctx.setLineDash([6, 7]);
  trace();
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/finish marker.
  const sx = tx(pts[0][0]);
  const sy = ty(pts[0][1]);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(4, roadW * 0.4), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(2, roadW * 0.18), 0, Math.PI * 2);
  ctx.fill();
}
