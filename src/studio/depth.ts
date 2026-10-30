import * as THREE from 'three';

// Atlas lift is an orthographic clip-depth offset. In perspective it can pull
// ground details through the whole building; isolated studies have no survey lift.
export function usePhysicalDepth(scene: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) {
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      const physical = shader.vertexShader.replace(/gl_Position\.z\s*\+=\s*projectionMatrix\[2\]\[2\]\s*\*[^;]+;/g, '');
      if (physical !== shader.vertexShader && !this.polygonOffset) {
        // Resolve coplanar ground contacts without a world-sized depth displacement.
        this.polygonOffset = true; this.polygonOffsetFactor = -1; this.polygonOffsetUnits = -1;
      }
      shader.vertexShader = physical;
    };
    material.customProgramCacheKey = () => key + ':studio-physical-depth';
    material.needsUpdate = true;
  }
}
