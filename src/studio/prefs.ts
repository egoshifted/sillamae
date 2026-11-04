const KEY = 'studio:setup';

export interface PlanSetup {view: string; look: string; panX: number; panY: number; zoom: number}
export interface CameraSetup {position: number[]; target: number[]}
export interface FolderSetup {open: string[]; collapsed: string[]}

export interface StudioSetup {
  plan: boolean;
  grid: boolean;
  toolbox: boolean;
  explorer: boolean;
  hints: boolean;
  distance: string;
  light: string;
  shadows: boolean;
  textures: boolean;
  plain: boolean;
  ground: boolean;
  gizmo: string;
  building: string;
  mode: string;
  planView: string;
  planLook: string;
  plans: Record<string, PlanSetup>;
  cameras: Record<string, CameraSetup>;
  folders: Record<string, FolderSetup>;
}

function blank(): StudioSetup {
  return {
    plan: false, grid: false, toolbox: true, explorer: true, hints: true,
    distance: '1', light: 'midday', shadows: true, textures: true, plain: false, ground: true,
    gizmo: 'translate', building: '', mode: '', planView: '', planLook: '', plans: {}, cameras: {}, folders: {},
  };
}

const PLAN_VIEWS = new Set(['above', 'front', 'right', 'back', 'left']);
const PLAN_LOOKS = new Set(['textured', 'plain', 'xray', 'deep', 'lines', 'line-xray']);

function flag(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

export function readSetup(): StudioSetup {
  const empty = blank();
  let raw: unknown;
  try { raw = JSON.parse(localStorage.getItem(KEY) ?? ''); }
  catch { return empty; }
  if (!raw || typeof raw !== 'object') return empty;
  const saved = raw as Partial<StudioSetup>;
  return {
    plan: flag(saved.plan, empty.plan),
    grid: flag(saved.grid, empty.grid),
    toolbox: flag(saved.toolbox, empty.toolbox),
    explorer: flag(saved.explorer, empty.explorer),
    hints: flag(saved.hints, empty.hints),
    shadows: flag(saved.shadows, empty.shadows),
    textures: flag(saved.textures, empty.textures),
    plain: flag(saved.plain, empty.plain),
    ground: flag(saved.ground, empty.ground),
    distance: saved.distance === '2' || saved.distance === '4' ? saved.distance : '1',
    light: saved.light === 'morning' || saved.light === 'late' ? saved.light : 'midday',
    gizmo: saved.gizmo === 'rotate' || saved.gizmo === 'scale' ? saved.gizmo : 'translate',
    building: typeof saved.building === 'string' ? saved.building : '',
    mode: typeof saved.mode === 'string' ? saved.mode : '',
    planView: PLAN_VIEWS.has(saved.planView ?? '') ? saved.planView ?? '' : '',
    planLook: PLAN_LOOKS.has(saved.planLook ?? '') ? saved.planLook ?? '' : '',
    plans: saved.plans && typeof saved.plans === 'object' ? saved.plans : {},
    cameras: saved.cameras && typeof saved.cameras === 'object' ? saved.cameras : {},
    folders: saved.folders && typeof saved.folders === 'object' ? saved.folders : {},
  };
}

export function writeSetup(setup: StudioSetup) {
  try { localStorage.setItem(KEY, JSON.stringify(setup)); }
  catch { /* Storage can be disabled; the setup then lasts for this tab. */ }
}
