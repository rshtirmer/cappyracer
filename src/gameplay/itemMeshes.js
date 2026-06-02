import * as THREE from 'three';
import { COLORS } from '../core/Constants.js';

/** A glowing "?" face texture for the mystery box. */
function makeQuestionTexture() {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d');
  // Rounded panel.
  ctx.fillStyle = '#ffce24';
  ctx.beginPath();
  ctx.roundRect(6, 6, n - 12, n - 12, 22);
  ctx.fill();
  // Inset border.
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#c9690d';
  ctx.stroke();
  // Bold DARK "?" with a light halo — high contrast from a distance + survives
  // bloom (a light "?" washes out against the glowing yellow box).
  ctx.font = 'bold 104px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#fff3c8';     // cream halo to separate from the yellow
  ctx.strokeText('?', n / 2, n / 2 + 4);
  ctx.fillStyle = '#4a2200';       // dark brown fill (reads near + far)
  ctx.fillText('?', n / 2, n / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/**
 * The mystery item box: a glowing "?" cube with a bright inner core and a white
 * edge outline. Returns a Group (spun/bobbed by ItemSystem). Bloom flares the
 * emissive "?" + core for that arcade pickup look.
 */
export function makeItemBox() {
  const group = new THREE.Group();
  const tex = makeQuestionTexture();

  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55,
    metalness: 0.15, roughness: 0.45, transparent: true, opacity: 0.93,
  });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), mat);
  cube.castShadow = true;
  group.add(cube);

  // Bright inner core (reads through the translucent faces; blooms).
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 0),
    new THREE.MeshBasicMaterial({ color: 0xfff1c0 })
  );
  group.add(core);
  group.userData.core = core;

  // Crisp edge outline.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: COLORS.ITEM_BOX_EDGE })
  );
  group.add(edges);

  group.userData.noPS2 = true;
  return group;
}

/** Forward-pointing chevrons for a boost pad (arrows point toward texture +v). */
export function makeBoostPadTexture() {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, n, n);
  // Faint rounded panel.
  ctx.fillStyle = 'rgba(73,214,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(8, 8, n - 16, n - 16, 18);
  ctx.fill();
  // Three bright chevrons pointing "up" (toward +v / forward once aligned).
  ctx.strokeStyle = '#dffaff';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const y = 86 - i * 26;
    ctx.beginPath();
    ctx.moveTo(34, y);
    ctx.lineTo(64, y - 24);
    ctx.lineTo(94, y);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/**
 * The thrown yuzu (CappyRacer's "shell"): a clone of the orange GLB, normalized
 * to `diameter` and base-less centered so it tumbles cleanly in flight. Falls
 * back to a simple sphere if the model isn't loaded.
 */
export function makeYuzu(orangeGltf, diameter = 0.95) {
  if (!orangeGltf) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(diameter / 2, 14, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.SHELL, emissive: COLORS.SHELL, emissiveIntensity: 0.25 })
    );
    mesh.userData.noPS2 = true;
    return mesh;
  }
  const model = orangeGltf.scene.clone(true);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const s = diameter / (Math.max(size.x, size.y, size.z) || 1);
  model.scale.setScalar(s);
  model.position.set(-center.x * s, -center.y * s, -center.z * s); // center on origin
  // Clone borrows geometry/material/texture from orangeGltf — flag it so removal
  // (disposeObject3D) frees only the wrapper, never the shared source resources.
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    o.userData.sharedGeometry = true; o.userData.sharedMaterial = true;
  });
  const group = new THREE.Group();
  group.add(model);
  group.userData.noPS2 = true;
  return group;
}
