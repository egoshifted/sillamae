import type {HeightAt} from '../src/engine/survey/drape.ts';
import type {Point2} from '../src/engine/types.ts';

// Source x/z; half is half the carriageway width.
export interface Centreline {
  points: Point2[];
  half: number;
}

const STEP = 1, SMOOTH = 12, BLEND = 3, CELL = 8; // metres

type Segment = {line: number; a: Point2; b: Point2; ha: number; hb: number; half: number};

// The terrain is graded to the road rather than the road laid on the terrain:
// each centreline's terrain profile is smoothed along the road, the corridor
// takes that height straight across, and the terrain blends back over BLEND
// beyond the edge. Where corridors overlap their heights are averaged by
// weight, so junctions have no steps.
export function gradeRoads(heightAt: HeightAt, lines: Centreline[]): HeightAt {
  const segments: Segment[] = [], grid = new Map<string, number[]>();
  lines.forEach(({points, half}, line) => {
    const dense = densify(points), raw = dense.map(([x, z]) => heightAt(x, z));
    const smooth = raw.map((_, i) => {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - SMOOTH / STEP); j <= Math.min(raw.length - 1, i + SMOOTH / STEP); j++) if (raw[j] !== null) { sum += raw[j]!; n++; }
      return n ? sum / n : null;
    });
    for (let i = 1; i < dense.length; i++) {
      if (smooth[i - 1] === null || smooth[i] === null) continue;
      const [a, b] = [dense[i - 1], dense[i]], reach = half + BLEND;
      const s = segments.push({line, a, b, ha: smooth[i - 1]!, hb: smooth[i]!, half}) - 1;
      for (let cx = Math.floor((Math.min(a[0], b[0]) - reach) / CELL); cx <= Math.floor((Math.max(a[0], b[0]) + reach) / CELL); cx++)
        for (let cz = Math.floor((Math.min(a[1], b[1]) - reach) / CELL); cz <= Math.floor((Math.max(a[1], b[1]) + reach) / CELL); cz++) {
          const k = cx + ',' + cz;
          let list = grid.get(k);
          if (!list) grid.set(k, list = []);
          list.push(s);
        }
    }
  });
  return (x, z) => {
    const h = heightAt(x, z);
    if (h === null) return null;
    const nearest = new Map<number, {w: number; p: number}>();
    for (const index of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const {line, a, b, ha, hb, half} = segments[index], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t), w = 1 - smoothstep((d - half) / BLEND);
      if (w > (nearest.get(line)?.w ?? 0)) nearest.set(line, {w, p: ha + (hb - ha) * t});
    }
    if (!nearest.size) return h;
    let weight = 0, sum = 0, strength = 0;
    for (const {w, p} of nearest.values()) { weight += w; sum += w * p; strength = Math.max(strength, w); }
    return h + (sum / weight - h) * strength;
  };
}

const smoothstep = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

function densify(points: Point2[]) {
  const out: Point2[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [p, q] = [points[i - 1], points[i]], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / STEP));
    for (let k = 1; k <= steps; k++) out.push([p[0] + (q[0] - p[0]) * k / steps, p[1] + (q[1] - p[1]) * k / steps]);
  }
  return out;
}
