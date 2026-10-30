import * as THREE from 'three';
import {bucketSurvey, expandBucket} from '../engine/survey/classify.ts';
import {groundWithin} from '../engine/survey/carve.ts';
import type {Building, WorldFrame} from '../engine/types.ts';
import type {StudyModel} from './types.ts';

let original: Promise<Float32Array> | undefined;
export function sourceSurvey() {
  return original ??= (async () => {
    const response = await fetch('/data/source/geometry.bin.gz'); if (!response.ok) throw Error('Original survey unavailable');
    let bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if (bytes.byteLength % 84) throw Error('Invalid survey triangle buffer');
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  })();
}
export async function surveyGround(building: Building) {
  const xs = building.g.map(p => p[0]), zs = building.g.map(p => p[1]);
  return groundWithin(await sourceSurvey(), {minX: Math.min(...xs) - 15, maxX: Math.max(...xs) + 15, minZ: Math.min(...zs) - 15, maxZ: Math.max(...zs) + 15});
}
export async function createSurveyStudy(building: Building, frame: WorldFrame): Promise<StudyModel> {
  const vertices = await sourceSurvey(), selected: number[] = [], positions: number[] = [], colors: number[] = [];
  for (let i = 0; i < vertices.length; i += 21) {
    if (vertices[i + 6] !== building.pick) continue;
    for (let j = i; j < i + 21; j++) selected.push(vertices[j]);
  }
  for (const bucket of bucketSurvey(new Float32Array(selected), frame, new Set(), []).values()) {
    const expanded = expandBucket(new Float32Array(bucket.source), bucket.kind, frame);
    for (const value of expanded.position) positions.push(value);
    for (const value of bucket.c) colors.push(value);
  }
  if (!positions.length) throw Error('No original survey triangles for ' + building.id);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide});
  const root = new THREE.Mesh(geometry, material); root.name = 'original-survey'; root.castShadow = root.receiveShadow = true;
  return {root, dispose() { geometry.dispose(); material.dispose(); root.removeFromParent(); }};
}
