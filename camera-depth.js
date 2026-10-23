// Orthographic zoom changes the visible ground area, not camera distance.
// Keep the complete visible ground slab in front of the camera at every zoom.
export function fitCameraDepth(camera, target) {
  const direction = camera.position.clone().sub(target).normalize();
  const vertical = Math.max(.01, Math.abs(direction.y));
  const horizontal = Math.hypot(direction.x, direction.z);
  const halfView = (camera.top - camera.bottom) / (2 * camera.zoom);
  const groundDepth = halfView * horizontal / vertical;
  const margin = 200 / vertical;
  const distance = Math.max(1000, groundDepth + margin + 10);
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.near = Math.max(1, distance - groundDepth - margin);
  camera.far = distance + groundDepth + margin;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

