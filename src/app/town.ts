import {library} from '../city/sillamae/assets/library.ts';
import {sillamae} from '../city/sillamae/index.ts';
import {loadLines, loadPlacements, loadWorld, type SurveyBucket} from '../engine/data.ts';
import {tileLoader} from '../engine/tile-loader.ts';
import {shadowCoverage} from '../engine/lighting/shadow-coverage.ts';
import {Engine} from '../engine/engine.ts';
import {applyViewFromUrl} from './viewUrl.ts';

const DATA = './data/', PARALLEL = 6;

export interface Progress {
  loaded: number;
  total: number;
  viewReady: boolean;
  firstView: number; // ms since navigation start, 0 until known
  complete: number;
}

export interface TownState {
  engine: Engine | null;
  progress: Progress;
  error: string;
}

let state: TownState = {engine: null, progress: {loaded: 0, total: 0, viewReady: false, firstView: 0, complete: 0}, error: ''};
const listeners = new Set<() => void>();
let visibleTilesReady = () => false;
const update = (patch: Partial<TownState>) => {
  state = {...state, ...patch};
  for (const listener of listeners) listener();
};

// Lives outside React, so hot updates of components never start a second engine.
export const town = {
  async readyForView() {
    const deadline = performance.now() + 180000;
    while (!state.progress.viewReady || !visibleTilesReady()) {
      if (state.error) throw Error(state.error);
      if (performance.now() > deadline) throw Error('Timed out loading the view');
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    state.engine!.requestRedraw();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  },
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function openTown(container: HTMLElement) {
  load(container).catch(e => {
    console.error(e);
    update({error: e instanceof Error ? e.message : String(e)});
  });
}

async function load(container: HTMLElement) {
  for (const o of sillamae.overrides) o.preload?.();
  const placements = loadPlacements(DATA), lines = loadLines(DATA);
  const {world, survey} = await loadWorld(DATA);
  const engine = new Engine(container, {data: world, survey, city: sillamae});
  // Only approved assets ship; the data build already dropped placements of drafts.
  engine.addPlacements(await placements, new Map(library.map(a => [a.id, a])));
  engine.addLines(await lines);
  applyViewFromUrl(engine);
  update({engine});

  const progress = {...state.progress, total: survey.tiles.length}, root = document.documentElement;
  const report = () => update({progress: {...progress}});
  const loader = tileLoader(survey, engine.frame);
  const loaded = new Set<string>(), water = new Set(survey.buckets.filter(b => b.kind === 'water').map(b => b.tile));
  visibleTilesReady = () => {
    const radius = shadowCoverage(engine.camera.ortho, engine.camera.target);
    return engine.tilesByDistance(survey).every(t => loaded.has(t.name) || t.distance > radius && !water.has(t.name));
  };
  const add = (name: string, buckets: SurveyBucket[]) => {
    engine.addSurvey(buckets);
    loaded.add(name);
    progress.loaded++;
    report();
  };
  const tiles = engine.tilesByDistance(survey), radius = engine.camera.visibleRadius;
  const near = tiles.filter(t => t.distance <= radius), far = tiles.filter(t => t.distance > radius);
  root.dataset.tiles = 'loading';
  report();

  // The view's tiles download while Kesk 1 builds and the shaders compile;
  // the rest waits so it does not share the connection with them.
  try {
    const downloads = Promise.all(near.map(async t => ({name: t.name, buckets: await loader.load(DATA, t.name)})));
    const painted = engine.addRefinedBuildings(), compiled = engine.compile();
    for (const {name, buckets} of await downloads) add(name, buckets);
    await Promise.all([painted, compiled]);
    engine.start();
    Object.assign(progress, {viewReady: true, firstView: performance.now()});
    report();

    const remaining = new Set(far.map(t => t.name));
    const next = () => {
      const tile = engine.tilesByDistance(survey).find(t => remaining.has(t.name));
      if (tile) remaining.delete(tile.name);
      return tile;
    };
    await Promise.all(Array.from({length: PARALLEL}, async () => {
      for (let t = next(); t; t = next()) {
        add(t.name, await loader.load(DATA, t.name));
      }
    }));
    progress.complete = performance.now();
    engine.requestRedraw();
    report();
    root.dataset.tiles = 'done';
  } finally { loader.dispose(); }
}
