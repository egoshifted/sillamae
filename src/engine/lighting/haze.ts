import * as THREE from 'three';

// Visible metres, top to bottom, between which the air thickens. An orthographic
// view has no distance of its own, so the view's scale stands in for altitude.
const CLOSE = 140, FAR = 2400;
// Share of haze at the view's centre and at its far edge.
const CENTRE = {close: 0, far: .2}, EDGE = {close: .05, far: .46};

const undoSmoothstep = (y: number) => .5 - Math.sin(Math.asin(1 - 2 * y) / 3);

// Places THREE.Fog's smoothstep to give those shares at the current view. Call once
// fitCameraDepth has placed the camera: fog is measured from it, and it moves with zoom.
export function fitHaze(fog: THREE.Fog, camera: THREE.OrthographicCamera, target: THREE.Vector3) {
  const offset = camera.position.clone().sub(target), distance = offset.length();
  const vertical = Math.max(.01, Math.abs(offset.y) / distance), horizontal = Math.sqrt(1 - vertical * vertical);
  const halfView = (camera.top - camera.bottom) / (2 * camera.zoom);
  const altitude = THREE.MathUtils.smoothstep(Math.log(halfView * 2), Math.log(CLOSE), Math.log(FAR));
  const atCentre = undoSmoothstep(Math.max(1e-4, THREE.MathUtils.lerp(CENTRE.close, CENTRE.far, altitude)));
  const atEdge = undoSmoothstep(THREE.MathUtils.lerp(EDGE.close, EDGE.far, altitude));
  // Looking straight down the far edge is no further away, but the fit still needs a span.
  const depth = Math.max(halfView * horizontal / vertical, halfView * .5), range = depth / (atEdge - atCentre);
  fog.near = distance - atCentre * range;
  fog.far = fog.near + range;
}
