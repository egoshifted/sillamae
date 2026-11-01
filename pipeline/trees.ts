import type {SceneData} from '../src/engine/types.ts';
import {FOOTWAY, ROAD, surveyLayers} from './survey-colour.ts';

const CLEAR = .6, MAX_SHIFT = 5, STEP = .25; // metres

// Tree points are crown centres, so roadside crowns that lean over the road put the trunk on the carriageway.
export function moveTreesOffRoads(vertices: Float32Array, scene: SceneData) {
  const {layers, is} = surveyLayers(vertices);
  // The top layer is what is seen; lower stacked layers can carry another class.
  function surface(x: number, z: number) {
    const top = layers(x, z)[0]?.i;
    return top === undefined ? 'verge' : is(top, ROAD) ? 'road' : is(top, FOOTWAY) ? 'footway' : 'verge';
  }
  const clearOf = (x: number, z: number, avoid: string[]) => [[0, 0], ...Array.from({length: 8}, (_, k) => [Math.cos(k * Math.PI / 4) * CLEAR, Math.sin(k * Math.PI / 4) * CLEAR])]
    .every(([dx, dz]) => !avoid.includes(surface(x + dx, z + dz)));
  function nearest(x: number, z: number, avoid: string[]): [number, number] | null {
    for (let r = STEP; r <= MAX_SHIFT; r += STEP) for (let k = 0; k < 24; k++) {
      const p: [number, number] = [x + Math.cos(k * Math.PI / 12) * r, z + Math.sin(k * Math.PI / 12) * r];
      if (clearOf(...p, avoid)) return p;
    }
    return null;
  }
  let verge = 0, footway = 0, stranded = 0;
  for (const t of scene.trees) {
    const [x, z] = t.p;
    if (surface(x, z) !== 'road') continue;
    const p = nearest(x, z, ['road', 'footway']) ?? nearest(x, z, ['road']);
    if (!p) { stranded++; continue; }
    t.p = [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    if (surface(...t.p) === 'footway') footway++; else verge++;
  }
  return `trees moved off carriageways: ${verge} to verges, ${footway} to footways; ${stranded} left more than ${MAX_SHIFT} m from either`;
}
