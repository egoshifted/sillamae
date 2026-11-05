import type * as THREE from 'three';
import type {GroundTriangle, OverrideContext} from '../engine/types.ts';

export interface StudyModel {
  root: THREE.Object3D;
  shadowDetail?: {radius: number; normalBias: number};
  studyGround?: GroundTriangle[];
  dispose(): void;
  setTextures?(enabled: boolean): void;
  ready?: Promise<unknown>;
  // Convex plan areas in source x/z that the model opens in the diagnostic ground (stair pits, lightwells); the survey input is untouched.
  groundCuts?: [number, number][][];
  // Local survey objects can be misclassified as ground; hide only identified triangles in a study.
  keepGroundTriangle?(triangle:OverrideContext['ground'][number]):boolean;
}
export interface StudyDefinition {
  id: string;
  label?: string;
  studyGroundSource?: 'survey' | 'atlas';
  // cutsGround: remove the model's root.userData.groundPatches from the study ground, as the atlas does once registered.
  stages: Record<string, {label: string; build(context: OverrideContext): StudyModel | Promise<StudyModel>; cutsGround?: boolean}>;
}

