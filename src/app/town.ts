import {library} from '../city/sillamae/assets/library.ts';
import {sillamae} from '../city/sillamae/index.ts';
import {decodeTile, fetchTile, loadLines, loadPlacements, loadWorld} from '../engine/data.ts';
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
const update = (patch: Partial<TownState>) => {
  state = {...state, ...patch};
  for (const listener of listeners) listener();
};

// Lives outside React, so hot updates of components never start a second engine.
export const town = {
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
  const add = (name: string, buffer: ArrayBuffer) => {
    engine.addSurvey(decodeTile(survey, name, buffer, engine.frame));
    progress.loaded++;
    report();
  };
  const tiles = engine.tilesByDistance(survey), radius = engine.camera.visibleRadius;
  const near = tiles.filter(t => t.distance <= radius), far = tiles.filter(t => t.distance > radius);
  root.dataset.tiles = 'loading';
  report();

  // The view's tiles download while Kesk 1 builds and the shaders compile;
  // the rest waits so it does not share the connection with them.
  const downloads = near.map(t => fetchTile(DATA, t.name));
  const painted = engine.addRefinedBuildings(), compiled = engine.compile();
  for (const [i, t] of near.entries()) add(t.name, await downloads[i]);
  await Promise.all([painted, compiled]);
  engine.start();
  Object.assign(progress, {viewReady: true, firstView: performance.now()});
  report();

  await Promise.all(Array.from({length: PARALLEL}, async () => {
    for (let t = far.shift(); t; t = far.shift()) add(t.name, await fetchTile(DATA, t.name));
  }));
  progress.complete = performance.now();
  report();
  root.dataset.tiles = 'done';
}
