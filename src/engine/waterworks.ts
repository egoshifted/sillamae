import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MIRRORED} from './survey/water.ts';
import type {Waterwork} from './types.ts';

const SOLID: Partial<Record<Waterwork['material'], {color: string; roughness: number}>> = {
  concrete: {color: '#a19e94', roughness: .92}, dark: {color: '#4a4744', roughness: .95},
  rail: {color: '#d4cfc0', roughness: .8}, roof: {color: '#74767a', roughness: .85},
};

// White water is dense at the middle of the patch and breaks up towards open water.
function foamTexture() {
  const size = 256, canvas = document.createElement('canvas'), paint = canvas.getContext('2d')!;
  canvas.width = canvas.height = size;
  let seed = 73;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  paint.fillStyle = '#f4f7f5';
  for (let i = 0; i < 1500; i++) {
    const a = random() * Math.PI * 2, r = random() ** .7, fade = 1 - r;
    paint.globalAlpha = (.08 + .5 * fade) * (.4 + random() * .6);
    paint.beginPath();
    paint.ellipse(size / 2 + Math.cos(a) * r * size * .47, size / 2 + Math.sin(a) * r * size * .47, 2 + random() * (3 + 13 * fade), 2 + random() * (2 + 8 * fade), random() * Math.PI, 0, Math.PI * 2);
    paint.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function piece({from: [ax, az], to: [bx, bz], width, bottom, top, material}: Waterwork, base: number) {
  const length = Math.hypot(bx - ax, bz - az);
  const geometry = material === 'foam' ? new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).scale(length, 1, width) : new THREE.BoxGeometry(1, 1, 1).scale(length, top - bottom, width);
  return geometry.rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, material === 'foam' ? top - base : (bottom + top) / 2 - base, (az + bz) / 2);
}

// One draw per material: these are a few hundred triangles, and reflect in the water beside them.
export function addWaterworks(scene: THREE.Scene, works: Waterwork[], base: number) {
  const group = new THREE.Group();
  const add = (parts: THREE.BufferGeometry[], material: THREE.Material, solid: boolean) => {
    if (!parts.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(parts.map(p => p.toNonIndexed())), material);
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    mesh.layers.enable(MIRRORED);
    group.add(mesh);
  };
  for (const [name, finish] of Object.entries(SOLID)) add(works.filter(w => w.material === name).map(w => piece(w, base)), new THREE.MeshStandardMaterial(finish), true);
  const foam = works.filter(w => w.material === 'foam');
  if (foam.length) add(foam.map(w => piece(w, base)), new THREE.MeshStandardMaterial({map: foamTexture(), transparent: true, depthWrite: false, roughness: 1}), false);
  scene.add(group);
}
