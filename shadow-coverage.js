// Enclose the visible ground footprint, including tall receivers and casters.
// A sphere stays inside the light frustum for every sunlight direction.
export function shadowCoverage(camera, target) {
  const direction = camera.position.clone().sub(target).normalize();
  const vertical = Math.max(.01, Math.abs(direction.y));
  const halfWidth = (camera.right-camera.left)/(2*camera.zoom);
  const halfHeight = (camera.top-camera.bottom)/(2*camera.zoom);
  return Math.ceil((Math.hypot(halfWidth,halfHeight/vertical)+150/vertical+100)/50)*50;
}
// Detail quality depends on vertical framing, not the browser's aspect ratio.
export function useBuildingShadowDetail(camera,target,anchor){
  return (camera.top-camera.bottom)/camera.zoom<110 && target.distanceTo(anchor)<55;
}
