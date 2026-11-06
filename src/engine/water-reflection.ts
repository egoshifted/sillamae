import * as THREE from 'three';
import type {SurveyBucket} from './data.ts';
import {MIRRORED, type WaterSurface} from './survey/water.ts';

const LIVE_SCALE = .3, REST_SCALE = .6; // of the drawing buffer
const SETTLE_MS = 90; // the sharp image waits this long after the last move; a moving view draws the cheap one every frame
const MASK_CELL = 32, MASK_SIZE = 512, MASK_SAMPLES = 28, SHEET = 6000; // metres; the sheet under the town is wider

// Rounding as the camera is refitted each frame moves it by less than this, in metres, and an
// exact comparison would then redraw for ever. Only a real move updates the stored matrix, so a
// slow drift still adds up and registers.
const STILL = 1e-3;
export const sameView = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.every((value, i) => Math.abs(value - b.elements[i]) < STILL);

// Mirrors the camera about one plane. Because the view is orthographic, the same
// image serves water at any level: mirroring about a higher plane only shifts
// points by a constant, and the texture matrix applied to a fragment's own world
// position takes that shift out. So rivers above the sea need no pass of their own.
export function waterReflection(renderer: THREE.WebGLRenderer, surface: WaterSurface, plane: number) {
  const image = (scale: number, samples: number) => {
    const target = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, samples, depthBuffer: true});
    target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;
    return {target, scale};
  };
  const live = image(LIVE_SCALE, 0), sharp = image(REST_SCALE, 4);
  const mirror = new THREE.OrthographicCamera(), matrix = surface.reflectionMatrix.value;
  mirror.layers.set(MIRRORED);
  const last = new THREE.Matrix4(), size = new THREE.Vector2(), clearColour = new THREE.Color();
  const eye = new THREE.Vector3(), focus = new THREE.Vector3(), up = new THREE.Vector3(), view = new THREE.Vector3();
  const corner = new THREE.Vector3(), bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
  const mask = new Uint8Array(MASK_SIZE * MASK_SIZE), half = MASK_SIZE / 2;
  const reflect = (v: THREE.Vector3) => v.setY(2 * plane - v.y);
  let owed = true, changed = true, moved = 0;

  const markMask = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-6 || Math.max(ax, bx, cx) - Math.min(ax, bx, cx) > SHEET) return;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) / MASK_CELL) + half), i1 = Math.min(MASK_SIZE - 1, Math.floor(Math.max(ax, bx, cx) / MASK_CELL) + half);
    const j0 = Math.max(0, Math.floor(Math.min(az, bz, cz) / MASK_CELL) + half), j1 = Math.min(MASK_SIZE - 1, Math.floor(Math.max(az, bz, cz) / MASK_CELL) + half);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i - half + .5) * MASK_CELL, z = (j - half + .5) * MASK_CELL;
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      if (Math.min(a, b, 1 - a - b) > -.2) mask[j * MASK_SIZE + i] = 1;
    }
  };

  // The sea's sheets span the whole frustum whatever the view, so bounding spheres
  // cannot say whether water is on screen; a coarse map of it can.
  const waterInView = (camera: THREE.OrthographicCamera) => {
    camera.getWorldDirection(view);
    if (Math.abs(view.y) < 1e-4) return true;
    for (let v = 0; v <= MASK_SAMPLES; v++) for (let u = 0; u <= MASK_SAMPLES; u++) {
      corner.set(u / MASK_SAMPLES * 2 - 1, v / MASK_SAMPLES * 2 - 1, 0).unproject(camera);
      corner.addScaledVector(view, (plane - corner.y) / view.y);
      const i = Math.floor(corner.x / MASK_CELL) + half, j = Math.floor(corner.z / MASK_CELL) + half;
      if (i >= 0 && j >= 0 && i < MASK_SIZE && j < MASK_SIZE && mask[j * MASK_SIZE + i]) return true;
    }
    return false;
  };

  const render = (scene: THREE.Scene, camera: THREE.OrthographicCamera, {target, scale}: typeof live) => {
    renderer.getDrawingBufferSize(size);
    const width = Math.ceil(size.x * scale), height = Math.ceil(size.y * scale);
    if (target.width !== width || target.height !== height) target.setSize(width, height);
    camera.getWorldDirection(view);
    reflect(eye.copy(camera.position));
    reflect(focus.copy(camera.position).add(view));
    up.set(0, 1, 0).applyQuaternion(camera.quaternion).setY(-up.y);
    Object.assign(mirror, {left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom, near: camera.near, far: camera.far, zoom: camera.zoom});
    mirror.position.copy(eye);
    mirror.up.copy(up);
    mirror.lookAt(focus);
    mirror.updateProjectionMatrix();
    mirror.updateMatrixWorld();
    matrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

    const background = scene.background, alpha = renderer.getClearAlpha(), previous = renderer.getRenderTarget();
    // A shadow update here would see only this pass's layer; the main pass does it next.
    const shadows = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false;
    renderer.getClearColor(clearColour);
    scene.background = null;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0, 0);
    renderer.clear();
    renderer.render(scene, mirror);
    renderer.setRenderTarget(previous);
    renderer.setClearColor(clearColour, alpha);
    scene.background = background;
    renderer.shadowMap.needsUpdate = shadows;
    surface.reflectionMap.value = target.texture;
  };

  return {
    // Must see the same programs as the pass: render targets skip tone mapping.
    async compile(scene: THREE.Scene, camera: THREE.Camera) {
      renderer.setRenderTarget(live.target);
      await renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(null);
    },

    addWater(bucket: SurveyBucket) {
      const p = bucket.position, index = bucket.indices, count = (index ?? p).length / (index ? 3 : 9);
      for (let t = 0; t < count; t++) {
        const [a, b, c] = index ? [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]] : [t * 3, t * 3 + 1, t * 3 + 2];
        markMask(p[a * 3], p[a * 3 + 2], p[b * 3], p[b * 3 + 2], p[c * 3], p[c * 3 + 2]);
      }
      changed = true;
    },

    invalidate() {
      changed = true;
    },

    // True once a sharp image is owed and the camera has rested.
    pending(now: number) {
      return owed && now - moved >= SETTLE_MS;
    },

    // detailed: false at overview zoom, where buildings are too small to reflect.
    update(scene: THREE.Scene, camera: THREE.OrthographicCamera, now: number, detailed: boolean) {
      if (!sameView(camera.matrixWorld, last)) { changed = true; last.copy(camera.matrixWorld); }
      if (!changed && !(owed && now - moved >= SETTLE_MS)) return;
      const resting = !changed;
      if (changed) { changed = false; moved = now; owed = true; }
      else owed = false;
      const visible = detailed && waterInView(camera);
      surface.reflecting.value = visible ? 1 : 0;
      if (visible) render(scene, camera, resting ? sharp : live);
    },
  };
}

export type WaterReflection = ReturnType<typeof waterReflection>;
