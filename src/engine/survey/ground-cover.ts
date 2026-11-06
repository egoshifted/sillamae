import * as THREE from 'three';
import type {Building, Tree, WorldFrame} from '../types.ts';

const CELL = 6, MARGIN = 60, TENDED = 34; // metres; grass is kept short this far from a wall

const placeholder = new THREE.DataTexture(new Uint8Array(4), 1, 1);
placeholder.needsUpdate = true;

// Shared uniforms: refined sites draw their restored ground with their own material, and
// must agree with the survey beside them. Without a town (the studio) nothing is covered.
export const groundCover = {map: {value: placeholder as THREE.Texture}, area: {value: new THREE.Vector4(0, 0, 1, 1)}};

// Red: the ground under trees. Green: tended ground around buildings.
export function paintGroundCover(trees: Tree[], buildings: Building[], {origin: [ox, oz]}: WorldFrame) {
  const xs = [...trees.map(t => t.p[0]), ...buildings.flatMap(b => b.g.map(p => p[0]))], zs = [...trees.map(t => t.p[1]), ...buildings.flatMap(b => b.g.map(p => p[1]))];
  const minX = Math.min(...xs) - MARGIN, minZ = Math.min(...zs) - MARGIN, width = Math.max(...xs) + MARGIN - minX, depth = Math.max(...zs) + MARGIN - minZ;
  const sharp = document.createElement('canvas'), canvas = document.createElement('canvas');
  sharp.width = canvas.width = Math.ceil(width / CELL);
  sharp.height = canvas.height = Math.ceil(depth / CELL);
  const paint = sharp.getContext('2d')!;
  paint.fillRect(0, 0, sharp.width, sharp.height);
  paint.globalCompositeOperation = 'lighter';
  paint.fillStyle = 'rgb(170,0,0)';
  for (const t of trees) {
    paint.beginPath();
    paint.arc((t.p[0] - minX) / CELL, (t.p[1] - minZ) / CELL, Math.max(1, t.r * 1.2 / CELL), 0, Math.PI * 2);
    paint.fill();
  }
  paint.fillStyle = paint.strokeStyle = 'rgb(0,255,0)';
  paint.lineWidth = TENDED * 2 / CELL;
  paint.lineJoin = 'round';
  for (const b of buildings) {
    paint.beginPath();
    b.g.forEach(([x, z]) => paint.lineTo((x - minX) / CELL, (z - minZ) / CELL));
    paint.closePath();
    paint.fill();
    paint.stroke();
  }
  const soft = canvas.getContext('2d')!;
  soft.filter = 'blur(2px)';
  soft.drawImage(sharp, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  groundCover.map.value = texture;
  groundCover.area.value.set(minX - ox, minZ - oz, 1 / (canvas.width * CELL), 1 / (canvas.height * CELL));
}
