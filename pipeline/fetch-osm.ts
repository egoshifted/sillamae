import fs from 'node:fs';
import type {SceneData} from '../src/engine/types.ts';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const MARGIN = .005; // degrees around the surveyed buildings

interface Element {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  geometry?: {lat: number; lon: number}[];
  tags?: Record<string, string>;
}

async function overpass(query: string): Promise<Element[]> {
  for (const url of ENDPOINTS) {
    try {
      const response = await fetch(url, {method: 'POST', body: new URLSearchParams({data: query}), signal: AbortSignal.timeout(120000), headers: {'User-Agent': 'sillamae-atlas data pipeline'}});
      if (response.ok) return (await response.json()).elements;
      console.warn(`${url}: HTTP ${response.status}`);
    } catch (error) {
      console.warn(`${url}: ${(error as Error).message}`);
    }
  }
  throw new Error('No Overpass endpoint answered');
}

const way = (e: Element) => ({id: e.id, nodes: e.nodes!, points: e.geometry!.map(p => [p.lon, p.lat])});
const scene: SceneData = JSON.parse(fs.readFileSync('data/source/scene.json', 'utf8'));

const buildings = await overpass(`[out:json][timeout:120];way(id:${scene.buildings.map(b => b.id).join(',')});out geom;`);
const lons = buildings.flatMap(b => b.geometry!.map(p => p.lon)), lats = buildings.flatMap(b => b.geometry!.map(p => p.lat));
const bbox = [Math.min(...lats) - MARGIN, Math.min(...lons) - MARGIN, Math.max(...lats) + MARGIN, Math.max(...lons) + MARGIN].map(v => +v.toFixed(5));
const around = await overpass(`[out:json][timeout:120][bbox:${bbox.join(',')}];(way["highway"];node["entrance"];node["place"];);out geom;`);

const osm = {
  source: 'OpenStreetMap contributors, ODbL 1.0',
  fetched: new Date().toISOString().slice(0, 10),
  bbox,
  buildings: buildings.map(way),
  highways: around.filter(e => e.type === 'way').map(e => ({...way(e), tags: e.tags ?? {}})),
  entrances: around.filter(e => e.type === 'node' && e.tags?.entrance).map(e => ({id: e.id, point: [e.lon, e.lat], tags: e.tags!})),
  places: around.filter(e => e.type === 'node' && e.tags?.place).map(e => ({id: e.id, point: [e.lon, e.lat], tags: e.tags!})),
};
fs.writeFileSync('data/source/osm.json', JSON.stringify(osm));
console.log(`${osm.buildings.length}/${scene.buildings.length} buildings, ${osm.highways.length} ways, ${osm.entrances.length} entrances, ${osm.places.length} places`);
