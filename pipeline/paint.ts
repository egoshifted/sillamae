// The survey's paint meets the grid in metre steps, and a sharp edge there shows every one.
// Each point takes the mean of its neighbourhood, so an edge becomes a short gradient. Uniform
// areas keep their exact colour, which is what lets them coarsen into blocks.
export function softenPaint(points: ({x: number; z: number; c: number[] | undefined} | null)[], stride: number, reachAt: (x: number, z: number) => number) {
  const rows = points.length / stride;
  const soft = points.map((p, k) => {
    if (!p?.c) return null;
    const i = k % stride, j = Math.floor(k / stride), reach = reachAt(p.x, p.z), sum = [0, 0, 0];
    let n = 0, differs = false;
    for (let b = Math.max(0, j - reach); b <= Math.min(rows - 1, j + reach); b++) for (let a = Math.max(0, i - reach); a <= Math.min(stride - 1, i + reach); a++) {
      const c = points[b * stride + a]?.c;
      if (!c) continue;
      sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; n++;
      differs ||= c[0] !== p.c[0] || c[1] !== p.c[1] || c[2] !== p.c[2];
    }
    return differs ? sum.map(s => s / n) : null;
  });
  soft.forEach((c, k) => { if (c) points[k]!.c = c; });
}
