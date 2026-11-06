import * as THREE from 'three';
import {hash} from '../kajaka12a/textures.ts';
import {length, width} from './design.ts';

type Rect = [number, number, number, number];
export interface WearSheet {
  // Along-wall range and height range the sheet covers, in metres on that wall's plane.
  from: number; to: number; top: number;
  spalls: Rect[]; scuffs: Rect[]; stains: Rect[]; ochre: Rect[];
  cracks: [number, number, number, number][];
  dirt: number;
  tags: {text: string; s: number; h: number; size: number; colour: string; tilt: number; upright?: boolean; width?: number}[];
  marker?: {colour: string; arrow: {s: number; from: number; to: number}; smile: {s: number; h: number; size: number}};
}

// Rects are centre s, centre h, width, height. Positions on the north-west sheet are scaled from
// the owner's near-frontal 2024 photograph at about 108 px/m. South-east and rear come from oblique owner
// photographs, spaced against the louvres and rear openings, so they are rougher; front is rougher still.
export const wear: Record<'north' | 'south' | 'front' | 'rear', WearSheet> = {
  north: {
    from: 0, to: width - .55, top: 3.5, dirt: .5,
    spalls: [
      [.46, 1.16, .2, .38], [.37, .79, .3, .34], [.65, .69, .3, .28], [1.11, .88, .26, .14], [1.44, .94, .26, .08], [1.94, .91, .3, .1],
      [5.23, 1.3, .5, .08], [6.1, 1.09, .1, .15], [6.9, 1.13, .15, .17], [6.34, .91, .2, .09], [7.82, .9, .2, .08],
      [9.77, 1.5, .2, .4], [9.9, .88, .2, .1], [10.93, .79, .5, .4], [11.3, .72, .3, .34], [10.46, .69, .3, .2],
    ],
    scuffs: [
      [2.27, .6, .3, .2], [3.19, .32, .5, .22], [3.56, .65, .3, .3], [1.44, .3, .2, .2], [2.18, .32, .3, .2],
      [6.57, .83, .5, .2], [7.1, .88, .3, .15], [9.26, .56, .3, .15], [8.94, .3, .3, .15], [8.38, .55, .4, .06],
    ],
    stains: [], ochre: [],
    cracks: [[9.81, 1.25, 9.95, .2], [5, 1.2, 5.7, 1.06], [2.64, 3.33, 3.29, 3.29], [7.7, 2.9, 8.2, 2.86]],
    tags: [{text: 'Gonood', s: 6.87, h: 1.44, size: .15, colour: '#2f6fb0', tilt: 0, upright: true, width: .38}],
    marker: {colour: '#2f6fb0', arrow: {s: 7.08, from: 1.21, to: 1.66}, smile: {s: 7.22, h: 1.44, size: .1}},
  },
  south: {
    from: .55, to: width, top: 2, dirt: .45,
    spalls: [
      [3.1, 1.6, .28, .18], [3.55, 1.55, .25, .1], [4.4, 1.6, .16, .22], [3.65, .8, .5, .12], [4.25, .84, .5, .16],
      [5.95, 1.08, .35, .24], [6.45, 1.14, .22, .3], [7.5, 1.1, .85, .26], [9.1, 1.2, .3, .08], [1.3, .25, .3, .1],
    ],
    scuffs: [[3.9, 1.57, .3, .12], [5.2, .55, .5, .15], [8.5, .6, .6, .18]],
    stains: [], ochre: [],
    cracks: [],
    tags: [
      {text: 'ЗАГЛЯНИ', s: 1.7, h: 1.4, size: .3, colour: '#2b2b2b', tilt: -.03},
      {text: '♡', s: 2.75, h: 1.6, size: .42, colour: '#2b2b2b', tilt: 0},
      {text: '«ВНУТРЬ СЕБЯ!', s: 2, h: 1, size: .28, colour: '#2b2b2b', tilt: .03},
    ],
  },
  front: {
    from: .55, to: length - .55, top: 1.25, dirt: .4,
    spalls: [[3.75, .55, .3, .35], [7.25, .5, .3, .3]],
    scuffs: [[1.3, .75, .9, .3], [2.6, .55, .7, .3], [8.2, .7, .9, .35], [9.5, .5, .6, .25]],
    stains: [[1.9, .3, 2.6, .35], [8.6, .3, 2.8, .35]], ochre: [],
    cracks: [[1.6, 1.15, 1.9, .5], [8.9, 1.1, 8.6, .55], [9.6, .95, 9.9, .45], [3.2, 1, 3.05, .45]],
    tags: [],
  },
  rear: {
    from: .1, to: length - .1, top: 2.2, dirt: .55,
    spalls: [],
    scuffs: [[length - .9, .5, .45, .36], [length - 1.5, .38, .5, .25]],
    // Damp rises highest near the north corner and falls away towards the door.
    stains: [[length - .95, .5, 1.7, 1], [length - 3.3, .32, 3, .64]],
    ochre: [[length - 2.65, .55, .7, .18]],
    cracks: [[length - .12, 1.9, length - .4, 1.2], [length - 1, 1.55, length - .45, 1.2]],
    tags: [{text: 'КЗ', s: length - 2.4, h: 1.7, size: .09, colour: '#b3483a', tilt: 0}],
  },
};

const pixelsPerMetre = 160;

export function paintWear(sheet: WearSheet, seed: number) {
  if (typeof document === 'undefined') {
    const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    blank.needsUpdate = true;
    return blank;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((sheet.to - sheet.from) * pixelsPerMetre);
  canvas.height = Math.round(sheet.top * pixelsPerMetre);
  const ctx = canvas.getContext('2d')!;
  const x = (s: number) => (s - sheet.from) * pixelsPerMetre, y = (h: number) => (sheet.top - h) * pixelsPerMetre;
  let counter = seed;
  const random = () => hash(counter++, seed * 31 + 7);
  const blob = ([s, h, w, tall]: Rect, grow = 1) => {
    const points = 16;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const angle = i / points * Math.PI * 2, reach = (.62 + random() * .55) * grow;
      const px = x(s) + Math.cos(angle) * w / 2 * pixelsPerMetre * reach, py = y(h) + Math.sin(angle) * tall / 2 * pixelsPerMetre * reach;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  const soft = ([s, h, w, tall]: Rect, colour: string) => {
    ctx.save();
    ctx.translate(x(s), y(h));
    ctx.scale(w / 2 * pixelsPerMetre, tall / 2 * pixelsPerMetre);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, colour);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };

  const dirt = ctx.createLinearGradient(0, y(sheet.dirt), 0, y(0));
  dirt.addColorStop(0, 'rgba(95,88,62,0)');
  dirt.addColorStop(1, 'rgba(95,88,62,.42)');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, y(sheet.dirt), canvas.width, canvas.height - y(sheet.dirt));

  sheet.stains.forEach(rect => {
    soft(rect, 'rgba(92,98,62,.6)');
    soft([rect[0], rect[1] - rect[3] * .12, rect[2] * .7, rect[3] * .75], 'rgba(92,98,62,.45)');
  });
  for (const rect of sheet.scuffs) {
    ctx.fillStyle = 'rgba(176,176,166,.5)';
    blob(rect);
    ctx.fillStyle = 'rgba(205,205,195,.4)';
    blob([rect[0] + .03, rect[1] + .02, rect[2] * .6, rect[3] * .6]);
  }
  sheet.ochre.forEach(rect => soft(rect, 'rgba(196,158,92,.85)'));
  for (const rect of sheet.spalls) {
    ctx.fillStyle = 'rgba(238,234,216,.75)';
    blob(rect, 1.12);
    // Exposed render is mid grey-brown; darker reads as holes once the wall is in shade.
    ctx.fillStyle = '#ad9f8a';
    blob(rect);
    ctx.fillStyle = '#857663';
    for (let i = 0; i < 3; i++) blob([rect[0] + (random() - .5) * rect[2] * .5, rect[1] + (random() - .5) * rect[3] * .5, rect[2] * .28, rect[3] * .28]);
  }
  ctx.lineCap = 'round';
  for (const [s0, h0, s1, h1] of sheet.cracks) {
    ctx.strokeStyle = 'rgba(92,82,66,.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x(s0), y(h0));
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, jitter = i === steps ? 0 : (random() - .5) * 7;
      ctx.lineTo(x(s0 + (s1 - s0) * t) + jitter, y(h0 + (h1 - h0) * t) + jitter * .5);
    }
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const tag of sheet.tags) {
    ctx.save();
    ctx.translate(x(tag.s), y(tag.h));
    ctx.rotate(tag.tilt);
    ctx.fillStyle = tag.colour;
    ctx.font = `${tag.upright ? '' : 'italic '}${Math.round(tag.size * pixelsPerMetre)}px "Segoe Script", "Comic Sans MS", cursive`;
    if (tag.width) ctx.fillText(tag.text, 0, 0, tag.width * pixelsPerMetre);
    else ctx.fillText(tag.text, 0, 0);
    ctx.restore();
  }
  if (sheet.marker) {
    const {colour, arrow, smile} = sheet.marker, head = .06 * pixelsPerMetre, ax = x(arrow.s);
    ctx.strokeStyle = ctx.fillStyle = colour;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ax, y(arrow.from));
    ctx.lineTo(ax, y(arrow.to));
    for (const [tip, back] of [[y(arrow.to), head], [y(arrow.from), -head]]) {
      ctx.moveTo(ax - head * .7, tip + back);
      ctx.lineTo(ax, tip);
      ctx.lineTo(ax + head * .7, tip + back);
    }
    ctx.stroke();
    const sx = x(smile.s), sy = y(smile.h), r = smile.size * pixelsPerMetre;
    ctx.beginPath();
    ctx.arc(sx, sy, r, -Math.PI / 2.6, Math.PI / 2.6);
    ctx.stroke();
    for (const offset of [-.45, .45]) {
      ctx.beginPath();
      ctx.arc(sx - r * .25, sy + offset * r, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}
