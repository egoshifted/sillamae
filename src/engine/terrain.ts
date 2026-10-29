import type {TerrainGrid} from './types.ts';

export function terrainHeight(t: TerrainGrid, x: number, z: number) {
  const gx = Math.max(0, Math.min(t.width - 1.001, (x - t.origin[0]) / t.step));
  const gz = Math.max(0, Math.min(t.height - 1.001, (z - t.origin[1]) / t.step));
  const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j, k = j * t.width + i, h = t.values;
  return (h[k] * (1 - u) * (1 - v) + h[k + 1] * u * (1 - v) + h[k + t.width] * (1 - u) * v + h[k + t.width + 1] * u * v) / 10;
}
