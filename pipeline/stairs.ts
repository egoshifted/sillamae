import type {Georeference, OsmExtract} from './geo.ts';
import type {Stair} from '../src/engine/data.ts';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import type {CityDefinition, SceneData} from '../src/engine/types.ts';

const DEFAULT_WIDTH = 2.5, RISER = .15, LIFT = .05; // metres
const SITE_MARGIN = 15;

// One flight per segment of every OSM steps way, its ends on the 1 m terrain
// model. Width and step count come from OSM tags where mapped.
export function buildStairs(osm: OsmExtract, scene: SceneData, city: CityDefinition, {local}: Georeference, heightAt: HeightAt) {
  const [ox, oz] = city.frame.origin;
  const sites = city.overrides.map(o => scene.buildings.find(b => b.id === o.id)!).map(b => {
    const xs = b.g.map(p => p[0] - ox), zs = b.g.map(p => p[1] - oz);
    return {minX: Math.min(...xs) - SITE_MARGIN, maxX: Math.max(...xs) + SITE_MARGIN, minZ: Math.min(...zs) - SITE_MARGIN, maxZ: Math.max(...zs) + SITE_MARGIN};
  });
  const inSite = ([x, z]: [number, number]) => sites.some(s => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ);
  const stairs: Stair[] = [];
  let estimated = 0;
  for (const way of osm.highways) {
    if (way.tags.highway !== 'steps') continue;
    const points = way.points.map(p => local(p));
    if (points.some(inSite)) continue;
    const width = parseFloat(way.tags.width) || DEFAULT_WIDTH, count = parseInt(way.tags.step_count) || 0;
    if (!way.tags.width) estimated++;
    const heights = points.map(([x, z]) => heightAt(x + ox, z + oz));
    if (heights.includes(null)) continue;
    const total = points.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
    for (let i = 1; i < points.length; i++) {
      const rise = Math.abs(heights[i]! - heights[i - 1]!), run = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      const steps = count ? Math.max(1, Math.round(count * run / total)) : Math.max(1, Math.round(rise / RISER));
      const end = (j: number): [number, number, number] => [points[j][0], round(heights[j]! - scene.base + LIFT), points[j][1]];
      stairs.push({from: end(i - 1), to: end(i), width, steps});
    }
  }
  return {stairs, report: `stairs ${stairs.length} flights from ${osm.highways.filter(w => w.tags.highway === 'steps').length} OSM steps ways; width estimated for ${estimated}`};
}

const round = (v: number) => Math.round(v * 100) / 100;
