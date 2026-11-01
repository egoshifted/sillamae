import * as THREE from 'three';
import {bucketSurvey, type Site} from './classify.ts';
import {carveGroundPatches, groundWithin} from './carve.ts';
import {drapeGround, settleBuildings, type HeightAt} from './drape.ts';
import {TRIANGLE, type CityDefinition, type GroundTriangle, type Polygon, type SceneData, type WorldFrame} from '../types.ts';

const SITE_MARGIN = 15;

// Overrides are built here only to learn their ground patches; the viewer
// builds them again from the recorded site ground.
export function prepareSurvey(vertices: Float32Array, data: SceneData, city: CityDefinition, heightAt?: HeightAt) {
  const frame: WorldFrame = {origin: city.frame.origin, base: data.base};
  const building = (id: string) => {
    const b = data.buildings.find(b => b.id === id);
    if (!b) throw new Error(`Building ${id} is not in the scene data`);
    return b;
  };
  for (const o of city.overrides) if (o.carveSurvey) vertices = o.carveSurvey(vertices, building(o.id));
  const settled = heightAt ? settleBuildings(vertices, data, heightAt) : 0;
  if (heightAt) for (const t of data.trees) t.z = heightAt(t.p[0], t.p[1]) ?? t.z;
  addHeightRanges(vertices, data, frame);
  const sites: Site[] = [], skip = new Set<number>(), siteGround: Record<string, GroundTriangle[]> = {}, patches: Polygon[] = [];
  for (const o of city.overrides) {
    const b = building(o.id), xs = b.g.map(p => p[0]), zs = b.g.map(p => p[1]);
    const site = {minX: Math.min(...xs) - SITE_MARGIN, maxX: Math.max(...xs) + SITE_MARGIN, minZ: Math.min(...zs) - SITE_MARGIN, maxZ: Math.max(...zs) + SITE_MARGIN};
    const ground = siteGround[o.id] = groundWithin(vertices, site);
    const built = o.build({scene: new THREE.Scene(), building: b, terrain: data.terrain, frame, ground});
    vertices = carveGroundPatches(vertices, built.groundPatches, built.groundPatchMinHeight);
    patches.push(...built.groundPatches);
    sites.push(site);
    skip.add(b.pick);
  }
  const buckets = [...bucketSurvey(vertices, frame, skip, sites).values()];
  const draped = heightAt ? drapeGround(buckets, heightAt, sites) : null;
  return {buckets, siteGround, settled, draped, patches};
}

function addHeightRanges(v: Float32Array, data: SceneData, frame: WorldFrame) {
  const low = new Map<number, number>(), high = new Map<number, number>();
  for (let i = 0; i < v.length; i += TRIANGLE) {
    const pick = v[i + 6];
    if (!pick) continue;
    for (const h of [v[i + 2], v[i + 9], v[i + 16]]) {
      low.set(pick, Math.min(low.get(pick) ?? Infinity, h));
      high.set(pick, Math.max(high.get(pick) ?? -Infinity, h));
    }
  }
  const round = (h: number) => Math.round((h - frame.base) * 100) / 100;
  for (const b of data.buildings) if (low.has(b.pick)) b.heightRange = [round(low.get(b.pick)!), round(high.get(b.pick)!)];
}
