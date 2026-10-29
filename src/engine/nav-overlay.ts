import * as THREE from 'three';
import type {NavData} from './data.ts';
import {terrainHeight} from './terrain.ts';
import type {TerrainGrid, WorldFrame} from './types.ts';

const LIFT = .6;
const ROADS = new Set(['primary', 'secondary', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'track']);

export function navOverlay(nav: NavData, terrain: TerrainGrid, frame: WorldFrame) {
  const [ox, oz] = frame.origin;
  const at = ([x, z]: [number, number]) => [x, terrainHeight(terrain, x + ox, z + oz) - frame.base + LIFT, z];
  const entrance = nav.kinds.indexOf('entrance');
  const colours = {road: new THREE.Color('#5d6670'), path: new THREE.Color('#1f6fe0'), link: new THREE.Color('#e0322b')};
  const positions: number[] = [], colors: number[] = [];
  for (const [a, b, , k] of nav.edges) {
    const c = k === entrance ? colours.link : ROADS.has(nav.kinds[k]) ? colours.road : colours.path;
    positions.push(...at(nav.nodes[a]), ...at(nav.nodes[b]));
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  lines.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const doors = new THREE.BufferGeometry();
  doors.setAttribute('position', new THREE.Float32BufferAttribute(nav.entrances.flatMap(e => at(nav.nodes[e.node])), 3));
  const group = new THREE.Group();
  const onTop = {depthTest: false, transparent: true};
  group.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({vertexColors: true, ...onTop})));
  group.add(new THREE.Points(doors, new THREE.PointsMaterial({color: '#f08c00', size: 6, sizeAttenuation: false, ...onTop})));
  group.renderOrder = 10;
  group.children.forEach(o => o.renderOrder = 10);
  return group;
}
