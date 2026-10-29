import * as THREE from 'three';
import {shadowCoverage, useBuildingShadowDetail} from './shadow-coverage.ts';

export function addSun(scene: THREE.Scene, renderer: THREE.WebGLRenderer, daylight: number) {
  scene.add(new THREE.HemisphereLight('#e6efff', '#73775c', 1.1));
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -145, right: 145, top: 145, bottom: -145, near: 1, far: 320});
  sun.shadow.bias = -.0001;
  sun.shadow.normalBias = .04;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);
  const offset = new THREE.Vector3(), centre = new THREE.Vector3(1e9, 0, 0);
  let width = 0, detailed = false;

  const sunlight = {
    state: () => ({mapSize: sun.shadow.mapSize.x, radius: width, detailed}),

    setDaylight(k: number) {
      offset.set(-280 + 560 * k, 150 + 200 * Math.sin(k * Math.PI), -100);
      centre.set(1e9, 0, 0); // force the frustum to refresh
      sun.color.set(k < .25 ? '#ffd2a0' : k > .8 ? '#ffd6ac' : '#fff1dc');
      sun.intensity = 2 + Math.sin(k * Math.PI) * .4;
      renderer.shadowMap.needsUpdate = true;
    },

    follow(camera: THREE.OrthographicCamera, target: THREE.Vector3, anchors: THREE.Vector3[]) {
      const anchor = nearest(anchors, target);
      const detail = !!anchor && useBuildingShadowDetail(camera, target, anchor);
      detailed = detail;
      const want = detail ? anchor : target, radius = detail ? 100 : shadowCoverage(camera, target);
      const mapSize = detail ? 4096 : 2048;
      if (sun.shadow.mapSize.x !== mapSize) {
        sun.shadow.mapSize.set(mapSize, mapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        renderer.shadowMap.needsUpdate = true;
      }
      // A 600 m depth range made the old detail bias detach shadows by 15 cm.
      // Keep the detail receiver offset below the thin apron/foundation contact.
      sun.shadow.bias = detail ? -.00004 : -.0005;
      sun.shadow.normalBias = detail ? .06 : .22;
      if (centre.distanceTo(want) > (detail ? .01 : 25) || Math.abs(width - radius) > 20) {
        centre.copy(want);
        width = radius;
        sun.target.position.copy(centre);
        sun.position.copy(centre).addScaledVector(offset.clone().normalize(), radius + 200);
        Object.assign(sun.shadow.camera, {left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: 2 * radius + 400});
        sun.shadow.camera.updateProjectionMatrix();
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
