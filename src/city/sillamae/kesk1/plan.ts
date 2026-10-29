import type {Point2} from '../../../engine/types.ts';

// Rounded survey vertices skew the returns; each fitted line retains its original midpoint offset.
export function orthogonalPlan(points: Point2[]): Point2[] {
  if (points.length !== 20 || points.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw new Error('Unexpected Kesk 1 footprint');
  let cosine = 0, sine = 0;
  points.forEach((a, i) => { const b = points[(i + 1) % points.length], x = b[0] - a[0], z = b[1] - a[1], sign = i % 2 ? 1 : -1; cosine += sign * (x * x - z * z); sine += sign * 2 * x * z; });
  const bearing = Math.atan2(sine, cosine) / 2, u = [Math.cos(bearing), Math.sin(bearing)], v = [-u[1], u[0]];
  const lines = points.map((a, i) => { const b = points[(i + 1) % points.length], n = i % 2 ? v : u; return ((a[0] + b[0]) * n[0] + (a[1] + b[1]) * n[1]) / 2; });
  return points.map((_, i) => { const previous = (i + points.length - 1) % points.length, x = lines[i % 2 ? previous : i], z = lines[i % 2 ? i : previous]; return [x * u[0] + z * v[0], x * u[1] + z * v[1]]; });
}
