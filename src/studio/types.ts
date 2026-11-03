import type * as THREE from 'three';
import type {OverrideContext} from '../engine/types.ts';

export interface StudyModel {
  root: THREE.Object3D;
  dispose(): void;
  setTextures?(enabled: boolean): void;
  ready?: Promise<unknown>;
}
export interface StudyDefinition {
  id: string;
  label?: string;
  // cutsGround: remove the model's root.userData.groundPatches from the study ground, as the atlas does once registered.
  stages: Record<string, {label: string; build(context: OverrideContext): StudyModel | Promise<StudyModel>; cutsGround?: boolean}>;
}
