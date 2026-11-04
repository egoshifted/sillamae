import type * as THREE from 'three';

export interface ToolboxItem {
  id: string;
  name: string;
  /** Shown while this part is the one being placed. */
  hint: string;
  /** Origin on the surface. +z faces away from it. */
  create(): THREE.Object3D;
}
