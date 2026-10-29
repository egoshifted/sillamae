import type * as THREE from 'three';

export type Point3 = [number, number, number];
export type Bounds = [number, number, number, number];
export type Face = 'NNE' | 'ESE' | 'SSW' | 'WNW' | 'WNW-NNE' | 'WNW-SSW' | 'SSW-ESE' | 'SSW-WNW' | 'WNW-end' | 'SSW-end';
export type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
export interface MeshGroup extends THREE.Group {children: ModelMesh[]}
export type Block = (name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material?: THREE.MeshStandardMaterial) => ModelMesh;
export type Emit = (name: string, points: number[][], indices: number[], material: THREE.MeshStandardMaterial) => ModelMesh;
export interface ShellMaterials {wall: THREE.MeshStandardMaterial; frame: THREE.MeshStandardMaterial; infill: THREE.MeshStandardMaterial}
export interface Opening {id: string; x: number; w: number; b: number; t: number; type?: string}
export interface Feature {name: string; material: string; vertices: number; bounds?: number[][]}
export interface ModelOptions {compact?: boolean}
