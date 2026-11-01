import type * as THREE from 'three';

// Source coordinates are metres in the survey plane: x east, z the second
// horizontal axis, plus absolute height. The renderer works in a local frame.
export interface WorldFrame {
  origin: [number, number]; // source x/z that maps to local 0/0
  base: number; // source height that maps to local y = 0
}

export type Point2 = [number, number];
export type Polygon = Point2[];

export interface Building {
  id: string; // OpenStreetMap way id
  pick: number; // survey triangle tag; 0 marks ground
  name: string;
  c: Point2; // centroid
  h: number;
  g: Polygon; // footprint
  heightRange?: [number, number];
  zone?: number;
}

export interface Tree {
  p: Point2;
  h: number;
  r: number;
  type: string; // Maa- ja Ruumiamet class: Lehtpuu (broadleaf) or Okaspuu (conifer)
  year: number;
  z: number; // ground height
  added?: string; // SiteTree id of a tree added in the studio
}

// Digital terrain model grid; values are heights in decimetres.
export interface TerrainGrid {
  origin: Point2;
  step: number;
  width: number;
  height: number;
  values: number[];
  meta: Record<string, unknown>;
}

export interface SceneData {
  trees: Tree[];
  terrain: TerrainGrid;
  base: number;
  buildings: Building[];
  boundary: Point2[];
}

// Survey mesh: 7 floats per vertex (x, z, height, r, g, b, pick), 21 per triangle.
export const VERTEX = 7;
export const TRIANGLE = 21;

// A ground triangle as source x/z/height for its three corners.
export type GroundTriangle = number[];

export interface OverrideContext {
  scene: THREE.Scene;
  building: Building;
  terrain: TerrainGrid;
  frame: WorldFrame;
  ground: GroundTriangle[];
  changed?(): void;
}

export interface BuiltOverride {
  root: THREE.Object3D;
  groundPatches: Polygon[];
  groundPatchMinHeight?: number; // exclude underlying water planes from material replacement
  setTextures(enabled: boolean): void;
  ready?: Promise<unknown>; // textures painted off the main thread
}

export interface BuildingOverride {
  id: string;
  carveSurvey?(vertices: Float32Array, building: Building): Float32Array;
  build(context: OverrideContext): BuiltOverride;
  preload?(): Promise<unknown>; // work that needs no scene data, started before it loads
  entrances?(building: Building): Point2[];
  view?: {offset: [number, number, number]; span: number};
  detailShadows?: boolean;
  // The model takes its height from the site ground it is given, so that ground
  // need not be eased toward a surveyed height.
  seatsOnGround?: boolean;
}

export type Attachment = 'ground' | 'wall';
export type AssetDetail = 'near' | 'far';

// A reusable object placed around the town: bins, benches, lamps. The id is
// permanent and never reused; placements refer to it.
export interface AssetDefinition {
  id: string;
  name: string;
  category: string;
  tags: string[];
  attach: Attachment | 'either';
  size: [number, number, number]; // metres along x, y, z, as built
  triangles: number; // budget for the near detail
  variants: {id: string; label: string}[]; // the first is the default
  retired?: boolean; // hidden from the palette, still drawn where placed
  // The origin is the contact point: the centre of the base on the ground, the
  // middle of the back against a wall. +z faces away from the wall.
  build(options: {variant: string; detail: AssetDetail}): THREE.Object3D;
}

export interface Placement {
  id: string;
  asset: string;
  variant?: string;
  p: [number, number, number]; // source x, z and absolute height of the contact point
  heading: number; // radians about the vertical; 0 faces +z
  attach: Attachment;
  building?: string; // the wall's building, for wall placements
}

// A tree added in the studio; moving a survey tree removes it and adds one of these.
export interface SiteTree {
  id: string;
  p: Point2; // source x/z
  z: number; // absolute ground height
  h: number;
  r: number;
  type: string; // as Tree.type
}

// One studio square and what was placed in it.
export interface PlacementSite {
  version: 1;
  id: string;
  square: {centre: Point2; size: number}; // source x/z, metres
  placements: Placement[];
  // Survey trees are named by position: the data build moves some by up to a few
  // metres, so an edit matches the nearest survey tree within TREE_MATCH.
  trees?: {remove: Point2[]; add: SiteTree[]};
  // Change to the terrain model over the square, centimetres on a TERRAIN_STEP grid
  // from its low corner, rows along z; see terrain-edit.ts.
  terrain?: {deltas: number[]};
}

export const TREE_MATCH = .75; // metres

export interface CityDefinition {
  frame: Omit<WorldFrame, 'base'>;
  defaultFocus: string;
  overrides: BuildingOverride[];
  extent?: Polygon; // convex, source x/z; the viewer clips everything outside it
}
