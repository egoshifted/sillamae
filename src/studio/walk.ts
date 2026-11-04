import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const MOVE: Record<string, string> = {KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd'};

// Slides the view across the ground: W forward, S back, A left, D right. Shift goes faster.
export function useWalk(camera: THREE.Camera, controls: OrbitControls) {
  const held = new Set<string>();
  const travel = new THREE.Vector3(), ahead = new THREE.Vector3(), side = new THREE.Vector3();
  let moving = false, at = 0;
  function step(now: number) {
    if (!moving) return;
    const dt = Math.min(.05, (now - at) / 1000 || 0);
    at = now;
    camera.getWorldDirection(ahead);
    ahead.y = 0;
    if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
    ahead.normalize();
    side.crossVectors(ahead, new THREE.Vector3(0, 1, 0)).normalize();
    travel.set(0, 0, 0);
    if (held.has('w')) travel.add(ahead);
    if (held.has('s')) travel.sub(ahead);
    if (held.has('d')) travel.add(side);
    if (held.has('a')) travel.sub(side);
    if (travel.lengthSq() > 0) {
      travel.normalize().multiplyScalar(Math.max(6, camera.position.distanceTo(controls.target)) * (held.has('shift') ? 1.8 : .65) * dt);
      camera.position.add(travel);
      controls.target.add(travel);
      controls.update();
    }
    if ([...'wasd'].some(key => held.has(key))) requestAnimationFrame(step);
    else moving = false;
  }
  const typing = (event: KeyboardEvent) => event.target instanceof Element && !!event.target.closest('input, textarea, select, .menu, .menu-pop, [contenteditable]');
  const down = (event: KeyboardEvent) => {
    if (typing(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = MOVE[event.code];
    if (!key) return;
    event.preventDefault();
    held.add(key);
    if (event.shiftKey) held.add('shift');
    if (!moving) { moving = true; at = performance.now(); requestAnimationFrame(step); }
  };
  const up = (event: KeyboardEvent) => {
    const key = MOVE[event.code];
    if (key) held.delete(key);
    if (event.code.startsWith('Shift') || !event.shiftKey) held.delete('shift');
  };
  const stop = () => { held.clear(); moving = false; };
  addEventListener('keydown', down);
  addEventListener('keyup', up);
  addEventListener('blur', stop);
  return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', stop); stop(); };
}
