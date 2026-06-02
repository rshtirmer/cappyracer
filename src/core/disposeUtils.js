/**
 * Centralized Three.js resource disposal.
 *
 * The hazard: cloned/instanced GLB content SHARES geometry, materials, and
 * textures with the persistent source gltf (SkeletonUtils.clone, Object3D.clone,
 * and Scenery's instanced bakes all borrow the source material). Disposing those
 * shared resources on a world teardown corrupts the persistent karts/scenery on
 * the next build. So objects that borrow resources opt OUT per-channel via
 * userData flags:
 *
 *   userData.sharedGeometry = true  -> geometry belongs to a persistent gltf
 *   userData.sharedMaterial = true  -> material + its textures belong to a gltf
 *
 * Everything else (procedural geometry/materials, CanvasTextures, the asphalt
 * load, hot-spring/crystal materials, the item box "?" + boost-pad textures) is
 * uniquely created per build and is freed here — that was the real leak: every
 * track switch minted fresh textures that nobody disposed.
 */

const MAP_KEYS = [
  'map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap',
  'aoMap', 'alphaMap', 'bumpMap', 'lightMap', 'displacementMap', 'specularMap',
];

/** Dispose a material and every texture map bound to it. */
export function disposeMaterial(m) {
  if (!m) return;
  for (const k of MAP_KEYS) {
    const t = m[k];
    if (t && t.isTexture && t.dispose) t.dispose();
  }
  if (m.dispose) m.dispose();
}

/**
 * Dispose every geometry / material / texture under `root`, skipping resources
 * flagged shared (borrowed from a persistent gltf). Safe to call on a worldGroup,
 * a swapped-out kart body, or a removed projectile.
 */
export function disposeObject3D(root) {
  if (!root) return;
  root.traverse((o) => {
    const ud = o.userData || {};
    if (o.geometry && o.geometry.dispose && !ud.sharedGeometry) o.geometry.dispose();
    if (ud.sharedMaterial) return;
    const m = o.material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach(disposeMaterial);
  });
}

/** Tag every mesh under `root` as borrowing geometry + material from a gltf. */
export function markShared(root) {
  root.traverse((o) => {
    if (o.isMesh) { o.userData.sharedGeometry = true; o.userData.sharedMaterial = true; }
  });
}
