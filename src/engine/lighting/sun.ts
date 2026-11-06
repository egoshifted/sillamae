import * as THREE from 'three';
import {shadowCoverage, useBuildingShadowDetail} from './shadow-coverage.ts';

export const buildingShadows = {radius: 100, mapSize: 4096, bias: -.00004, normalBias: .06, filterRadius: 3} as const;

// Shade takes the sky's blue, which is what sets it apart from the sun's warmth.
const LIGHT = {
  fill: new THREE.Color('#cfe0ff'), bounce: new THREE.Color('#a6a284'),
  lowSun: new THREE.Color('#ffcb9c'), highSun: new THREE.Color('#fff0d8'),
  lowAir: new THREE.Color('#dcd8d4'), highAir: new THREE.Color('#d2e0ea'),
};
const SUN_PATH = {rise: 105, set: 255, low: 12, high: 38}; // degrees: azimuth clockwise from north, height above the horizon

export function shadowDistance(radius: number) { return radius + 200; }

export function setShadowCoverage(sun: THREE.DirectionalLight, radius: number) {
  Object.assign(sun.shadow.camera, {left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: 2 * shadowDistance(radius)});
  sun.shadow.camera.updateProjectionMatrix();
}

export function addSun(scene: THREE.Scene, renderer: THREE.WebGLRenderer, daylight: number, maxMapSize = 4096) {
  const sky = new THREE.HemisphereLight(LIGHT.fill, LIGHT.bounce);
  scene.add(sky);
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -145, right: 145, top: 145, bottom: -145, near: 1, far: 320});
  sun.shadow.bias = -.0001;
  sun.shadow.normalBias = .04;
  sun.shadow.radius = buildingShadows.filterRadius;
  scene.add(sun);
  scene.add(sun.target);
  const offset = new THREE.Vector3(), centre = new THREE.Vector3(1e9, 0, 0), air = new THREE.Color();
  let width = 0, detailed = false;

  const sunlight = {
    intersects(sphere: THREE.Sphere) {
      const camera = sun.shadow.camera;
      camera.updateMatrixWorld();
      return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)).intersectsSphere(sphere);
    },
    state: () => ({mapSize: sun.shadow.mapSize.x, radius: width, detailed}),
    direction: () => offset.clone().normalize(),
    air,

    setDaylight(k: number) {
      // An autumn day at about 59° north. Local +x is east and +z south.
      const azimuth = THREE.MathUtils.degToRad(SUN_PATH.rise + (SUN_PATH.set - SUN_PATH.rise) * k);
      const height = THREE.MathUtils.degToRad(SUN_PATH.low + (SUN_PATH.high - SUN_PATH.low) * Math.sin(k * Math.PI));
      offset.set(Math.sin(azimuth) * Math.cos(height), Math.sin(height), -Math.cos(azimuth) * Math.cos(height));
      centre.set(1e9, 0, 0); // force the frustum to refresh
      const day = THREE.MathUtils.smoothstep(Math.sin(k * Math.PI), .1, .8);
      sun.color.copy(LIGHT.lowSun).lerp(LIGHT.highSun, day);
      sun.intensity = 2.7 + day * .2; // a lower sun strikes the ground less squarely
      // Lambert divides this by pi, and the tone curve crushes what is left in the shade.
      sky.intensity = 1.6 - day * .1;
      air.copy(LIGHT.lowAir).lerp(LIGHT.highAir, day);
      renderer.shadowMap.needsUpdate = true;
    },

    follow(camera: THREE.OrthographicCamera, target: THREE.Vector3, anchors: THREE.Vector3[]) {
      const anchor = nearest(anchors, target);
      const detail = !!anchor && useBuildingShadowDetail(camera, target, anchor);
      detailed = detail;
      const want = detail ? anchor : target, radius = detail ? buildingShadows.radius : shadowCoverage(camera, target);
      const mapSize = Math.min(maxMapSize, detail ? buildingShadows.mapSize : 2048);
      if (sun.shadow.mapSize.x !== mapSize) {
        sun.shadow.mapSize.set(mapSize, mapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        renderer.shadowMap.needsUpdate = true;
      }
      // A 600 m depth range made the old detail bias detach shadows by 15 cm.
      // Keep the detail receiver offset below the thin apron/foundation contact.
      sun.shadow.bias = detail ? buildingShadows.bias : -.0005;
      sun.shadow.normalBias = detail ? buildingShadows.normalBias : .22;
      if (centre.distanceTo(want) > (detail ? .01 : 25) || Math.abs(width - radius) > 20) {
        centre.copy(want);
        width = radius;
        sun.target.position.copy(centre);
        sun.position.copy(centre).addScaledVector(offset.clone().normalize(), shadowDistance(radius));
        setShadowCoverage(sun, radius);
        renderer.shadowMap.needsUpdate = true;
      }
    },
  };
  sunlight.setDaylight(daylight);
  return sunlight;
}

function nearest(points: THREE.Vector3[], target: THREE.Vector3) {
  let best: THREE.Vector3 | undefined;
  for (const p of points) if (!best || p.distanceTo(target) < best.distanceTo(target)) best = p;
  return best;
}
