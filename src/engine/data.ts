import {MeshoptDecoder} from 'meshoptimizer/decoder';
import * as THREE from 'three';
import {expandBucket, type Detail, type Surface} from './survey/classify.ts';
import type {GroundTriangle, SceneData, WorldFrame} from './types.ts';

export interface Zone {
  id: number;
  kind: 'block' | 'outskirts';
  buildings: string[];
  centre: [number, number];
  area: number;
}

// One straight flight, ends in the local frame (x, height, z).
export interface Stair {
  from: [number, number, number];
  to: [number, number, number];
  width: number;
  steps: number;
}

// Points in the local frame (x, height, z). Surface rings: outer first, then holes; outer
// counter-clockwise in (x, z), holes clockwise, so the surface is always left of travel.
export type LocalPoint = [number, number, number];
export interface Streets {
  carriageways: LocalPoint[][][];
  markings: LocalPoint[][][];
  // Carriageway edges that get a kerb, carriageway on the left; heights at road level.
  kerbs: LocalPoint[][];
  footways: LocalPoint[][][];
  pavers: LocalPoint[][][];
  paths: LocalPoint[][][];
  // Unkerbed carriageway, footway and path edges, surface on the left; heights at the surface.
  edges: LocalPoint[][];
}

export interface WorldData extends SceneData {
  zones: Zone[];
  stairs: Stair[];
  streets: Streets;
  siteGround: Record<string, GroundTriangle[]>;
  // Source x/z to EPSG:3301 easting/northing: [a, b, c, d, e, f] maps (x, z)
  // to (a x + b z + c, d x + e z + f). Fitted to OSM outlines; rms in metres.
  geo: {crs: string; toGrid: number[]; rms: number};
}

export interface NavData {
  kinds: string[];
  nodes: [number, number][];
  edges: [number, number, number, number][];
  entrances: {building: string; node: number; source: 'model' | 'osm' | 'estimated'}[];
}

// Tiles group TILE_CELLS² survey cells. A bucket's bytes in its tile, each
// section padded to 4 bytes: meshopt-encoded unique vertices (Uint32 x, z,
// height in millimetres above origin; sRGB bytes + pad), meshopt-encoded
// Uint32 corner indices, then one Uint16 building number and one Uint8 ground
// layer per triangle.
export interface SurveyManifest {
  cell: number;
  tileCells: number;
  tiles: string[];
  buckets: {
    kind: Surface; detail: Detail; cell: string; tile: string; offset: number;
    vertices: number; unique: number; vertexBytes: number; indexBytes: number; origin: [number, number, number];
  }[];
}

export interface SurveyBucket {
  index: number;
  position: Float32Array;
  color: Float32Array;
  uv: Float32Array;
  building: Uint16Array;
  layer: Uint8Array;
}

// Some servers (Vite's dev server among them) label .gz files with
// Content-Encoding and the browser has already inflated them.
async function gunzip(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = await response.arrayBuffer(), magic = new Uint8Array(bytes, 0, 2);
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) return bytes;
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

async function json<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

export const loadNav = (root: string) => json<NavData>(root + 'nav.json');

export async function loadWorld(root: string) {
  const [world, survey] = await Promise.all([json<WorldData>(root + 'world.json'), json<SurveyManifest>(root + 'survey.json'), MeshoptDecoder.ready]);
  return {world, survey};
}

const LINEAR = Float32Array.from({length: 256}, (_, k) => new THREE.Color().setRGB(k / 255, 0, 0, THREE.SRGBColorSpace).r);
const pad4 = (n: number) => Math.ceil(n / 4) * 4;

export const fetchTile = (root: string, name: string) => gunzip(`${root}tiles/${name}.bin.gz`);

export function decodeTile(survey: SurveyManifest, name: string, buffer: ArrayBuffer, frame: WorldFrame): SurveyBucket[] {
  return survey.buckets.flatMap((b, index) => {
    if (b.tile !== name) return [];
    const vertices = new Uint8Array(b.unique * 16), corners = new Uint32Array(b.vertices);
    MeshoptDecoder.decodeVertexBuffer(vertices, b.unique, 16, new Uint8Array(buffer, b.offset, b.vertexBytes));
    const indicesAt = b.offset + pad4(b.vertexBytes), trianglesAt = indicesAt + pad4(b.indexBytes);
    MeshoptDecoder.decodeIndexBuffer(new Uint8Array(corners.buffer), b.vertices, 4, new Uint8Array(buffer, indicesAt, b.indexBytes));
    const view = new DataView(vertices.buffer), source = new Float32Array(b.vertices * 3), color = new Float32Array(b.vertices * 3);
    for (let v = 0; v < b.vertices; v++) {
      const k = corners[v] * 16;
      for (let c = 0; c < 3; c++) {
        source[v * 3 + c] = (b.origin[c] + view.getUint32(k + c * 4, true)) / 1000;
        color[v * 3 + c] = LINEAR[vertices[k + 12 + c]];
      }
    }
    const count = b.vertices / 3, layersAt = trianglesAt + Math.ceil(count / 2) * 4;
    const buildings = new Uint16Array(buffer, trianglesAt, count), layers = new Uint8Array(buffer, layersAt, count);
    const building = new Uint16Array(b.vertices), layer = new Uint8Array(b.vertices);
    for (let t = 0; t < count; t++) {
      building.fill(buildings[t], t * 3, t * 3 + 3);
      layer.fill(layers[t], t * 3, t * 3 + 3);
    }
    return [{index, color, building, layer, ...expandBucket(source, b.kind, frame)}];
  });
}

export function tileBounds(survey: SurveyManifest, name: string) {
  const size = survey.cell * survey.tileCells, [tx, tz] = name.split('_').map(Number);
  return {minX: tx * size, maxX: (tx + 1) * size, minZ: tz * size, maxZ: (tz + 1) * size};
}
