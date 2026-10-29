import type * as THREE from 'three';
import type {Polygon} from '../../../engine/types.ts';
import type {design} from './config.ts';

export type Design = typeof design;
export interface BalconySchedule {rows: {section: number; floor: number; segments: {from: number; to: number; frame: string; panePitch?: number; cover?: string}[]}[]}
export type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
export interface Study extends THREE.Group {children: ModelMesh[]; userData: {audit: Audit; dispose(): void; [key: string]: unknown}}
export type Opening = {x: number; y: number; w: number; h: number} & (
  {kind: 'loggia'; floor: number; column?: never; id?: never} |
  {kind: 'window' | 'basement'; floor: number | 'B'; column: number; id: string} |
  {kind: 'stair' | 'entrance' | 'foundation-recess'; floor?: never; column?: never; id?: never}
);
export interface Audit {
  lightwells: {edge: number; window?: string; corners: Polygon; floor: number; ground: number}[];
  projections: Record<string,unknown>[];
  openings: (Opening & {edge: number})[];
  canopies: {edge: number; width: number; depth: number}[];
  roofs: {datum: number; continuousOutline: boolean}[];
  vents: {edge: number; fraction: number; depth: number}[];
  roofDividers: Record<string,unknown>[];
  facadeEdges: Design['facades'];
  fit: {angle: number; points: Polygon; maximumMovement: number};
  localFootprint: Polygon;
  importedLocal: Polygon;
  sectionAlignmentMovement: number;
  roofEdgeThickness: number;
  detailDoorWidth?: {width: number; basis: string; inferred: boolean};
  detailEnclosures?: Record<string,unknown>[];
  roofFinish?: Record<string,unknown>;
  roofFixtures?: Record<string,unknown>[];
}
export interface Vertex {p: number[]; n: number[]; uv: number[]}
export type Rows = Vertex;
