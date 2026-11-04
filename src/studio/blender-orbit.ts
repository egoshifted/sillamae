import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const none = null as unknown as THREE.MOUSE;

// Middle mouse orbits. Shift+middle pans. Ctrl+middle zooms. The wheel zooms toward the cursor.
export function useBlenderOrbit(controls: OrbitControls) {
  const dom = controls.domElement;
  if (!dom) return;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = none;
  dom.addEventListener('pointerdown', event => {
    if (event.button !== 1) return;
    controls.mouseButtons.MIDDLE = event.ctrlKey || event.metaKey ? THREE.MOUSE.DOLLY : THREE.MOUSE.ROTATE;
  }, true);
  dom.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
}
