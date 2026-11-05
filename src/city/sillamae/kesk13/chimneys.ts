import * as THREE from 'three';
import {eaves, surveyRoof, type RoofShape, type SurveyPoint} from './design.ts';
import {roofHeight} from './roof.ts';

type Emit = (p: SurveyPoint) => void;
export const chimneyRows = [
  {edge: 0, fractions: [.22, .5, .78]},
  {edge: 7, fractions: [.22, .5, .78]},
] as const;

export function addChimneys(wall: Emit, metal: Emit, inside: Emit, part: (id: string, name: string) => void, shape: RoofShape = surveyRoof, refined = false) {
  for (const row of chimneyRows) {
    const a = eaves[row.edge], b = eaves[(row.edge + 1) % eaves.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
    for (const [group, t] of row.fractions.entries()) for (const [stack, setback] of [1.7, 3.25, 4.8].entries()) {
      const cx = a[0] + (b[0] - a[0]) * t - uz * setback;
      const cz = a[1] + (b[1] - a[1]) * t + ux * setback;
      const at = (u: number, s: number, height: number): SurveyPoint => [cx + ux * u - uz * s, cz + uz * u + ux * s, height];
      const ground = (u: number, s: number, lift: number) => {const [x, z] = at(u, s, 0); return roofHeight(x, z, shape) + lift;};
      const rectangle = (w: number, d: number, height: number | ((u: number, s: number) => number)) => [[-w, -d], [w, -d], [w, d], [-w, d]].map(([u, s]) => at(u, s, typeof height === 'number' ? height : height(u, s)));
      const w=refined ? [.34,.19,.28][stack] : .34, depth=refined ? [.4,.25,.34][stack] : .4;
      const lower = rectangle(w, depth, (u, s) => ground(u, s, .035));
      const top = Math.max(...lower.map(p => p[2])) + (refined ? [1.0,.50,.85][stack] : 1.1);
      const upper = rectangle(w, depth, top - .08), rim = rectangle(w+.06, depth+.06, top);
      const lip = rectangle(w+.06, depth+.06, top - .08), hole = rectangle(w-.12, depth-.12, top);
      const well = rectangle(w-.12, depth-.12, top - .42);
      const id = `chimney-${row.edge}-${group}-${stack}`, name = `Edge ${row.edge} chimney group ${group + 1} stack ${stack + 1}`;
      function surface(points: SurveyPoint[], normal: number[], emit: Emit) {
        for (let i = 1; i < points.length - 1; i++) {
          const [p, q, r] = [points[0], points[i], points[i + 1]];
          const cross = new THREE.Vector3(q[0] - p[0], q[2] - p[2], q[1] - p[1]).cross(new THREE.Vector3(r[0] - p[0], r[2] - p[2], r[1] - p[1]));
          (cross.dot(new THREE.Vector3(...normal)) >= 0 ? [p, q, r] : [p, r, q]).forEach(emit);
        }
      }
      const normals = [[uz, 0, -ux], [ux, 0, uz], [-uz, 0, ux], [-ux, 0, -uz]];
      part(id + '/body', name + ' body');
      for (let i = 0; i < 4; i++) {const j = (i + 1) % 4; surface([lower[i], lower[j], upper[j], upper[i]], normals[i], wall);}
      part(id + '/flashing', name + ' flashing and rim');
      const apron = rectangle(w+.15, depth+.15, (u, s) => ground(u, s, .035));
      const foot = rectangle(w+.15, depth+.15, (u, s) => ground(u, s, 0));
      const collar = rectangle(w, depth, (u, s) => ground(u, s, .18));
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        surface([apron[i], apron[j], collar[j], collar[i]], [0, 1, 0], metal);
        surface([foot[i], foot[j], apron[j], apron[i]], normals[i], metal);
        surface([rim[i], rim[j], hole[j], hole[i]], [0, 1, 0], metal);
        surface([lip[i], lip[j], rim[j], rim[i]], normals[i], metal);
        surface([upper[i], upper[j], lip[j], lip[i]], [0, -1, 0], metal);
      }
      part(id + '/flue', name + ' open flue');
      for (let i = 0; i < 4; i++) {const j = (i + 1) % 4; surface([hole[i], hole[j], well[j], well[i]], normals[i].map(v => -v), inside);}
      surface(well, [0, 1, 0], inside);
    }
  }
}

