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
}

export interface BuiltOverride {
  root: THREE.Object3D;
  groundPatches: Polygon[];
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
}

export interface CityDefinition {
  frame: Omit<WorldFrame, 'base'>;
  defaultFocus: string;
  overrides: BuildingOverride[];
}
