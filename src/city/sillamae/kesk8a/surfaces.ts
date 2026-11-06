import * as THREE from 'three';
import {hash, noise, texture} from '../kajaka12a/textures.ts';
import {surfaces} from '../kesk1/surfaces.ts';
import {corrugatedNormal} from '../kesk13/roof-finish.ts';
import {paintWear, wear} from './wear.ts';

export const plainColours = {
  wall: '#c5c7be', trim: '#c5c7be', soffit: '#f1f1e8', foundation: '#8f918a', roof: '#55585a', cheek: '#4f5a63', glass: '#39464c', blank: '#dad8ce',
  door: '#6f6a63', rearDoor: '#6f6a63', louvre: '#7c7e78', steps: '#a3a59d', frame: '#c5c7be', grille: '#c5c7be', metal: '#c5c7be', rail: '#6f6a63', dark: '#55585a', sign: '#c5c7be', block: '#a3a59d',
  wearNorth: '#ffffff', wearSouth: '#ffffff', wearFront: '#ffffff', wearRear: '#ffffff',
};
export type Finish = keyof typeof plainColours;

const finishedColours: Record<Finish, string> = {
  wall: '#f4edd2', trim: '#f8f3de', soffit: '#fbf7e4', foundation: '#c9c2a8', roof: '#ffffff', cheek: '#4f5a63', glass: '#44545c', blank: '#efeee6',
  door: '#e7e4d8', rearDoor: '#4a2b22', louvre: '#b7b5a8', steps: '#c2c0b6', frame: '#f1f1ea', grille: '#d9dad4', metal: '#c6cbcb', rail: '#7b4431', dark: '#2b2c2b', sign: '#ffffff', block: '#a8a79d',
  wearNorth: '#ffffff', wearSouth: '#ffffff', wearFront: '#ffffff', wearRear: '#ffffff',
};
const wearSheets = {wearNorth: wear.north, wearSouth: wear.south, wearFront: wear.front, wearRear: wear.rear};
const isWear = (name: Finish): name is keyof typeof wearSheets => name in wearSheets;

// Metres covered by one tile of each textured finish. Absent finishes have no map.
const tiles: Partial<Record<Finish, number>> = {wall: 3, trim: 3, soffit: 3, foundation: 1.6, steps: 1.2, block: 1.2};
const sheetTile = {across: 3.6, down: 2.4};

// Stays near white because it multiplies the wall colour; only broad patches read at town scale.
const plaster = () => texture(256, (x, y) => {
  const broad = noise(x, y, 64, 64, 256), fine = noise(x, y, 8, 8, 256);
  return 240 + broad * 10 + fine * 5;
}, true);

// Lapped rows every 1.2 m with joints staggered by half a sheet, as on the owner's close view of the roof.
const sheets = () => {
  const size = 512, rowHeight = size / 2, sheetWidth = size / 3;
  return texture(size, (x, y) => {
    const row = Math.floor(y / rowHeight), along = x + (row % 2 ? sheetWidth / 2 : 0), sheet = Math.floor(along / sheetWidth) % 3;
    const lap = y % rowHeight < 5, joint = along % sheetWidth < 2;
    const shade = (hash(sheet, row) - .5) * 7, lichen = Math.max(0, noise(x, y, 8, 8, size) - .68) * 70;
    const base = 84 + noise(x, y, 64, 64, size) * 22 + shade + (hash(x, y) - .5) * 7 + lichen;
    // Faint, or the laps read as a checkerboard from the street.
    return lap ? base * .8 : joint ? base * .92 : base;
  }, true);
};

function signFace() {
  if (typeof document === 'undefined') {
    const map = new THREE.DataTexture(new Uint8Array([236, 234, 226, 255]), 1, 1);
    map.needsUpdate = true;
    return map;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 462;
  const ctx = canvas.getContext('2d')!, {width: w, height: h} = canvas;
  const px = (x: number) => x * w, py = (y: number) => y * h;
  let seed = 11;
  const random = () => hash(seed++, 53);
  // Traces a painted edge: the sign's colour fields were brushed by hand, so no boundary is clean.
  const rough = (points: [number, number][], jitter: number) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const steps = i ? 6 : 1, [fromX, fromY] = points[Math.max(i - 1, 0)];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, ox = (random() - .5) * jitter, oy = (random() - .5) * jitter;
        ctx.lineTo(px(fromX + (x - fromX) * t) + ox, py(fromY + (y - fromY) * t) + oy);
      }
    });
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#e8e5da';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d9713a';
  rough([[0, 0], [.2, 0], [.14, .1], [.07, .24], [.035, .42], [.02, .6], [0, .62]], 9);
  rough([[1, 0], [.79, 0], [.86, .06], [.92, .18], [.955, .34], [.965, .55], [1, .6]], 9);
  rough([[1, 1], [1, .78], [.975, .86], [.93, .95], [.9, 1]], 7);

  // A chisel nib: repeating each stroke along a slanted line gives the logo's thick-to-thin contrast.
  const nib = (width: number, draw: () => void) => {
    const steps = 9;
    ctx.lineWidth = width * .32;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1) - .5;
      ctx.save();
      ctx.translate(t * width * .62, -t * width * .78);
      ctx.beginPath();
      draw();
      ctx.stroke();
      ctx.restore();
    }
  };
  const baseline = py(.77), xHeight = py(.5), ink = '#55493a';
  ctx.strokeStyle = ctx.fillStyle = ink;
  ctx.save();
  // Slants the lettering about its baseline.
  ctx.transform(1, 0, -.2, 1, baseline * .2, 0);
  nib(44, () => {
    ctx.moveTo(px(.335), py(.3));
    ctx.lineTo(px(.325), baseline);
  });
  const letter = 30;
  nib(letter, () => {
    ctx.moveTo(px(.4), xHeight);
    ctx.lineTo(px(.4), baseline);
    ctx.moveTo(px(.4), py(.6));
    ctx.quadraticCurveTo(px(.425), py(.5), px(.462), py(.51));
  });
  nib(letter, () => ctx.ellipse(px(.52), py(.635), px(.042), py(.128), 0, 0, Math.PI * 2));
  nib(letter, () => {
    ctx.moveTo(px(.6), xHeight);
    ctx.lineTo(px(.6), baseline);
  });
  ctx.beginPath();
  ctx.arc(px(.605), py(.41), 11, 0, Math.PI * 2);
  ctx.fill();
  nib(letter, () => {
    ctx.moveTo(px(.66), py(.36));
    ctx.lineTo(px(.66), baseline);
    ctx.moveTo(px(.725), xHeight);
    ctx.lineTo(px(.665), py(.65));
    ctx.lineTo(px(.735), baseline);
  });
  nib(letter, () => ctx.ellipse(px(.79), py(.635), px(.04), py(.128), 0, 0, Math.PI * 2));
  nib(letter, () => {
    ctx.moveTo(px(.835), xHeight);
    ctx.lineTo(px(.835), py(.72));
    ctx.quadraticCurveTo(px(.845), baseline + 8, px(.925), py(.66));
  });
  ctx.restore();
  // The T's bar is drawn last and unslanted so it sweeps over the whole word as one brush stroke.
  ctx.beginPath();
  ctx.moveTo(px(.1), py(.56));
  ctx.bezierCurveTo(px(.17), py(.38), px(.3), py(.27), px(.46), py(.255));
  ctx.bezierCurveTo(px(.58), py(.245), px(.68), py(.255), px(.76), py(.29));
  ctx.bezierCurveTo(px(.66), py(.3), px(.56), py(.32), px(.45), py(.335));
  ctx.bezierCurveTo(px(.32), py(.355), px(.2), py(.43), px(.1), py(.56));
  ctx.fill();

  ctx.textAlign = 'center';
  // Spaced by hand: canvas letterSpacing is missing from some browsers this atlas supports.
  const spaced = (text: string, centre: number, baseY: number, pitch: number, radius = Infinity) => {
    [...text].forEach((character, i) => {
      const along = (i - (text.length - 1) / 2) * pitch, curved = Number.isFinite(radius);
      ctx.save();
      ctx.translate(centre + along, baseY + (curved ? along * along / (2 * radius) : 0));
      ctx.rotate(curved ? along / radius : 0);
      ctx.fillText(character, 0, 0);
      ctx.restore();
    });
  };
  ctx.fillStyle = '#7b7768';
  ctx.font = '600 25px Arial, sans-serif';
  spaced('OÜ RUSANIKA', px(.5), py(.15), 33, 900);
  ctx.fillStyle = '#4b6f9f';
  ctx.font = '700 33px Arial, sans-serif';
  spaced('KAUPLUS', px(.5), py(.945), 50);

  // Years outdoors: rain runs down from the top edge, and the paint has faded and chipped.
  ctx.lineCap = 'butt';
  for (let i = 0; i < 70; i++) {
    const x = random() * w, length = 40 + random() * 200;
    ctx.strokeStyle = `rgba(92,84,68,${.03 + random() * .06})`;
    ctx.lineWidth = 2 + random() * 7;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (random() - .5) * 8, length);
    ctx.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    const size = 1 + random() * 3.5, bright = random() > .45;
    ctx.fillStyle = bright ? `rgba(240,236,224,${.1 + random() * .3})` : `rgba(70,62,50,${.05 + random() * .14})`;
    ctx.fillRect(random() * w, random() * h, size, size);
  }
  ctx.strokeStyle = 'rgba(82,76,64,.8)';
  ctx.lineWidth = 7;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

export function createFinish() {
  const shared = surfaces(), concrete = shared.maps['concrete-v1'][0], [roughcast, roughcastRelief] = shared.maps['roughcast-v1'];
  const wallMap = plaster(), sheetMap = sheets(), sheetNormal = corrugatedNormal(), signMap = signFace();
  sheetMap.repeat.set(1 / sheetTile.across, 1 / sheetTile.down);
  sheetNormal.repeat.set(1 / .177, 1);
  const wearMaps = Object.fromEntries(Object.entries(wearSheets).map(([name, sheet], i) => [name, paintWear(sheet, i + 1)])) as unknown as Record<keyof typeof wearSheets, THREE.Texture>;
  const owned = [wallMap, sheetMap, sheetNormal, signMap, ...Object.values(wearMaps)];
  const wearMaterials: THREE.MeshStandardMaterial[] = [];
  const tracked: {material: THREE.MeshStandardMaterial; maps: Partial<Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'bumpMap'>>}[] = [];
  const mapsFor = (name: Finish): Partial<Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'bumpMap'>> => {
    if (name === 'wall' || name === 'trim' || name === 'soffit') return {map: wallMap};
    if (name === 'roof') return {map: sheetMap, normalMap: sheetNormal};
    if (name === 'foundation') return {map: roughcast, bumpMap: roughcastRelief};
    if (name === 'steps' || name === 'block') return {map: concrete};
    if (name === 'sign') return {map: signMap};
    return {};
  };
  return {
    ready: shared.ready,
    material(name: Finish) {
      const material = new THREE.MeshStandardMaterial({name, color: finishedColours[name], roughness: name === 'glass' ? .22 : name === 'frame' || name === 'metal' ? .6 : 1, metalness: name === 'metal' ? .25 : 0});
      if (isWear(name)) {
        // Decals sit millimetres off the wall, so they must not write depth or they fight it.
        Object.assign(material, {map: wearMaps[name], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
        wearMaterials.push(material);
        return material;
      }
      const maps = mapsFor(name);
      Object.assign(material, maps);
      // Stands in for light bounced up off the paving, which the scene's lighting does not model.
      if (name === 'soffit') material.emissive.set('#403d32');
      if (name === 'roof') material.normalScale.set(.7, .7);
      if (name === 'foundation') material.bumpScale = .03;
      if (Object.keys(maps).length) tracked.push({material, maps});
      return material;
    },
    setTextures(on: boolean) {
      // Without its map a decal would show as a solid white sheet, so it hides instead.
      for (const material of wearMaterials) material.visible = on;
      for (const {material, maps} of tracked) {
        Object.assign(material, on ? maps : {map: null, normalMap: null, bumpMap: null});
        material.needsUpdate = true;
      }
    },
    dispose() { owned.forEach(map => map.dispose()); },
  };
}

// Writes metre-scaled UVs from each face's direction; extruded and swept parts have none that match.
export function applyUV(root: THREE.Object3D) {
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const name = (child.material as THREE.Material).name as Finish;
    if (name === 'sign' || isWear(name)) return;
    const geometry = child.geometry as THREE.BufferGeometry, p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    const uv = new Float32Array(p.count * 2), tile = tiles[name] ?? 1, across = child.name === 'dormer-cap';
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      // Vertical faces need the generic mapping too: one axis would not vary, and the normal map then renders them black.
      const [s, t] = name === 'roof' && ny > .3
        // A slope's v runs along its fall, so waves stay straight down the roof. 1.18 is 1/cos of the 32 degree pitch.
        ? across ? [p.getZ(i), p.getX(i) * 1.18] : [p.getX(i), p.getZ(i) * 1.18]
        : ny > nx && ny > nz ? [p.getX(i), p.getZ(i)] : nx > nz ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
      uv[i * 2] = s / tile;
      uv[i * 2 + 1] = t / tile;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  });
}
