import * as THREE from 'three';

/** Crunchy, tileable canvas textures with PS2-style nearest filtering. */

function canvasTexture(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Nearest up close (crunchy PS2 look) but mipmapped at distance so the
  // tiled texture doesn't shimmer/flicker when minified.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  return t;
}

// Deterministic speckle so textures don't shimmer differently each load.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeGrassTexture() {
  return canvasTexture(128, (ctx, n) => {
    const rng = makeRng(7);
    ctx.fillStyle = '#6aa83b';
    ctx.fillRect(0, 0, n, n);
    const shades = ['#5e9a33', '#7cbf48', '#4f8a2c', '#82c64f', '#65a338'];
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = shades[(rng() * shades.length) | 0];
      ctx.fillRect((rng() * n) | 0, (rng() * n) | 0, 2, 2);
    }
  });
}

/** Real PSX asphalt texture (from the PSX Mega Pack) for the road surface. */
export function loadAsphaltTexture() {
  const t = new THREE.TextureLoader().load('textures/asphalt.png');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeAsphaltTexture() {
  return canvasTexture(128, (ctx, n) => {
    const rng = makeRng(13);
    ctx.fillStyle = '#494e56';
    ctx.fillRect(0, 0, n, n);
    const shades = ['#41454c', '#525861', '#3c4045', '#595f68'];
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = shades[(rng() * shades.length) | 0];
      ctx.fillRect((rng() * n) | 0, (rng() * n) | 0, 1, 1);
    }
    // a few faint cracks
    ctx.strokeStyle = 'rgba(30,32,36,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo((rng() * n) | 0, (rng() * n) | 0);
      ctx.lineTo((rng() * n) | 0, (rng() * n) | 0);
      ctx.stroke();
    }
  });
}
