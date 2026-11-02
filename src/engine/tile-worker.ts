import * as THREE from 'three';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {decodeTile, type SurveyManifest} from './data.ts';
import type {WorldFrame} from './types.ts';

const scope = globalThis as unknown as {onmessage: (event: MessageEvent) => void; postMessage(message: unknown, transfer?: Transferable[]): void};
let survey: SurveyManifest, frame: WorldFrame;
scope.onmessage = async ({data}) => {
  if (data.type === 'init') { survey = data.survey; frame = data.frame; return; }
  try {
    await MeshoptDecoder.ready;
    const buckets = decodeTile(survey, data.name, data.buffer, frame), transfer: Transferable[] = [];
    for (const bucket of buckets) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(bucket.position, 3));
      geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      bucket.normal = geometry.getAttribute('normal').array as Float32Array;
      const sphere = geometry.boundingSphere!;
      bucket.bounds = [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius];
      for (const array of [bucket.position, bucket.color, bucket.uv, bucket.building, bucket.layer, bucket.normal]) transfer.push(array.buffer as ArrayBuffer);
    }
    scope.postMessage({id: data.id, buckets}, transfer);
  } catch (error) { scope.postMessage({id: data.id, error: String(error)}); }
};
