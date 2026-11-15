import * as THREE from 'three';
import {surfaces} from '../kesk1/surfaces.ts';
import {plaster, sheets} from '../kesk8a/surfaces.ts';
import {corrugatedNormal, roofUV} from '../kesk13/roof-finish.ts';

export const plainColours = {
  wall: '#c5c7be', trim: '#d4d5cd', plinth: '#8f918a', foundation: '#7c7e78', roof: '#55585a', steps: '#a3a59d',
  frame: '#e4e4dc', darkFrame: '#e4e4dc', glass: '#39464c', door: '#6f6a63', metalDoor: '#6f6a63', porch: '#7d8a96', dormer: '#c5c7be',
  rail: '#4f4f4b', flashing: '#5d605e', grille: '#4f4f4b', vent: '#6f6a63',
};
export type Finish = keyof typeof plainColours;

// Street View 2023–24: pale yellow render flaking to white on every side, a blue-grey base band,
// red-brown dormers and doors, rust-brown iron. Frames differ by wall: brown on the street side, the wing and
// the east gable; white on the west gable and the rear.
const finishedColours: Record<Finish, string> = {
  wall: '#efe5b0', trim: '#f1ecd8', plinth: '#8f9ba3', foundation: '#8a8b85', roof: '#ffffff', steps: '#cfccc1',
  frame: '#efefe9', darkFrame: '#5b4636', glass: '#3c4a50', door: '#6e3328', metalDoor: '#a6a8a4', porch: '#6f7f8f', dormer: '#a2493a',
  rail: '#5a3a2c', flashing: '#575a57', grille: '#2e2f2c', vent: '#7a5b3e',
};

const bareRoof = '#6e7173';

// Metres covered by one tile of each textured finish.
const tiles: Partial<Record<Finish, number>> = {wall: 3, trim: 3, plinth: 1.6, foundation: 1.6, steps: 1.2, grille: .3};
// Kesk 8a's sheet texture holds three sheets across and two 1.2 m rows; roofUV counts across in corrugation waves.
const wave = .177, sheetTile = {across: 3.6, down: 2.4};

// Diamond lattice behind the glass, as on the frontispiece and east gable windows. Two diamonds a tile.
function lattice() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const bar = (x + y) % 32 < 3 || (x - y + 64) % 32 < 3;
    data.set([255, 255, 255, bar ? 255 : 0], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

export function createFinish() {
  const shared = surfaces(), concrete = shared.maps['concrete-v1'][0], [roughcast, roughcastRelief] = shared.maps['roughcast-v1'];
  const wallMap = plaster(), sheetMap = sheets(), sheetNormal = corrugatedNormal(), grilleMap = lattice();
  sheetMap.repeat.set(wave / sheetTile.across, 1 / sheetTile.down);
  const owned = [wallMap, sheetMap, sheetNormal, grilleMap];
  const tracked: {material: THREE.MeshStandardMaterial; maps: Partial<Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'bumpMap' | 'alphaMap'>>}[] = [];
  const mapsFor = (name: Finish): Partial<Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'bumpMap' | 'alphaMap'>> => {
    if (name === 'wall' || name === 'trim') return {map: wallMap};
    if (name === 'roof') return {map: sheetMap, normalMap: sheetNormal};
    if (name === 'plinth' || name === 'foundation') return {map: roughcast, bumpMap: roughcastRelief};
    if (name === 'steps') return {map: concrete};
    if (name === 'grille') return {alphaMap: grilleMap};
    return {};
  };
  return {
    ready: shared.ready,
    material(name: Finish) {
      const material = new THREE.MeshStandardMaterial({name, color: finishedColours[name], roughness: name === 'glass' ? .22 : name === 'rail' || name === 'metalDoor' ? .6 : 1, metalness: name === 'rail' ? .2 : 0});
      const maps = mapsFor(name);
      Object.assign(material, maps);
      // A cut-out, not blending: the lattice sits behind glass and must sort with the wall.
      if (name === 'grille') Object.assign(material, {alphaTest: .5, side: THREE.DoubleSide});
      if (name === 'roof') material.normalScale.set(.7, .7);
      if (name === 'plinth' || name === 'foundation') material.bumpScale = .03;
      if (Object.keys(maps).length) tracked.push({material, maps});
      return material;
    },
    setTextures(on: boolean) {
      for (const {material, maps} of tracked) {
        // Without its lattice the grille would cover the window as a solid sheet.
        if (material.name === 'grille') material.visible = on;
        // The sheet texture carries the roof's grey over a white base.
        if (material.name === 'roof') material.color.set(on ? finishedColours.roof : bareRoof);
        Object.assign(material, on ? maps : {map: null, normalMap: null, bumpMap: null, alphaMap: null});
        material.needsUpdate = true;
      }
    },
    dispose() { owned.forEach(map => map.dispose()); },
  };
}

// Writes metre-scaled UVs from each face's direction, and sheet-roof UVs that run down each slope.
export function applyUV(root: THREE.Object3D) {
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const name = (child.material as THREE.Material).name as Finish, geometry = child.geometry as THREE.BufferGeometry;
    if (name === 'roof') {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      roofUV(flat);
      if (flat !== geometry) { geometry.dispose(); child.geometry = flat; }
      return;
    }
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = new Float32Array(p.count * 2), tile = tiles[name] ?? 1;
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      const [s, t] = ny > nx && ny > nz ? [p.getX(i), p.getZ(i)] : nx > nz ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
      uv[i * 2] = s / tile;
      uv[i * 2 + 1] = t / tile;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  });
}
