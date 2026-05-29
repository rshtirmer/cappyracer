/**
 * PS2-style vertex "wobble": snap projected vertex positions to a coarse NDC
 * grid so geometry jitters as it moves — the classic early-3D look. Applied by
 * patching a material's vertex shader via onBeforeCompile. Skips skinned meshes
 * (the capybara), particles, and the sky (raw ShaderMaterial).
 */

export function applyVertexSnap(material, grid) {
  const mats = Array.isArray(material) ? material : [material];
  for (const m of mats) {
    if (!m || m.userData.ps2 || m.isShaderMaterial) continue;
    m.userData.ps2 = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader) => {
      if (prev) prev(shader);
      shader.uniforms.uSnap = { value: grid };
      shader.vertexShader = 'uniform float uSnap;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          float w = gl_Position.w;
          gl_Position.xyz /= w;
          gl_Position.xy = floor(gl_Position.xy * uSnap) / uSnap;
          gl_Position.xyz *= w;
        }`
      );
    };
    m.needsUpdate = true;
  }
}

export function applyVertexSnapToScene(scene, grid) {
  scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    if (o.isSkinnedMesh || o.userData.noPS2) return;
    applyVertexSnap(o.material, grid);
  });
}
