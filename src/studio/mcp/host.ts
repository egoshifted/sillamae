export interface PoseFact {
  position: number[];
  quaternion: number[];
  scale: number[];
}

export interface BoundsFact {
  size: number[];
  center: number[];
}

export interface PartFact {
  id: string;
  name: string;
  parent: string | null;
  kind: 'part' | 'group' | 'element';
  pose: PoseFact;
  bounds?: BoundsFact;
  material: string | null;
  visible: boolean;
  locked: boolean;
  selected: boolean;
}

export interface ViewState {
  light: string;
  shadows: boolean;
  textures: boolean;
  plain: boolean;
  ground: boolean;
  grid: boolean;
  plan: boolean;
  gizmo: string;
}

export interface PosePatch {
  position?: number[];
  quaternion?: number[];
  scale?: number[];
}

export interface StudioHost {
  identity(): {id: string; name: string; stage: string; ready: boolean};
  parts(): PartFact[];
  bounds(ids: string[]): Record<string, BoundsFact>;
  camera(): {position: number[]; target: number[]};
  view(): ViewState;
  cost(): {triangles: number; corners: number; draws: number};
  history(): {cursor: number; steps: {name: string}[]};
  edits(): {id: string; name: string}[];
  toolbox(): {id: string; name: string}[];
  select(ids: string[], mode: 'set' | 'add' | 'toggle'): void;
  hide(ids: string[]): void;
  show(ids: string[]): void;
  lock(ids: string[], on: boolean): void;
  group(ids: string[]): void;
  ungroup(ids: string[]): void;
  pose(ids: string[], next: PosePatch): void;
  place(item: string, position: number[]): void;
  setCamera(position: number[], target: number[]): void;
  setView(patch: Partial<ViewState>): void;
  undo(): void;
  redo(): void;
  save(): Promise<{saved?: string; error?: string}>;
}
