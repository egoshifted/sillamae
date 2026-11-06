import * as THREE from 'three';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {decodeTile, type SurveyManifest} from './data.ts';
import type {WorldFrame} from './types.ts';
import {compactBucket} from './survey/compact.ts';

const scope = globalThis as unknown as {onmessage: (event: MessageEvent) => void; postMessage(message: unknown, transfer?: Transferable[]): void};
let survey: SurveyManifest, frame: WorldFrame, flat = false;
scope.onmessage = async ({data}) => {
  if (data.type === 'init') { survey = data.survey; frame = data.frame; flat = data.flat; return; }
  try {
    await MeshoptDecoder.ready;
    const buckets = decodeTile(survey, data.name, data.buffer, frame), transfer: Transferable[] = [];
    for (let i = 0; i < buckets.length; i++) {
      let bucket = buckets[i];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(bucket.position, 3));
      if (!flat) {
        geometry.computeVertexNormals();
        const normal = bucket.normal = geometry.getAttribute('normal').array as Float32Array, smooth = bucket.smooth!;
        for (let k = 0; k < normal.length; k++) if (!Number.isNaN(smooth[k])) normal[k] = smooth[k];
      }
      delete bucket.smooth;
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere!;
      bucket.bounds = [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius];
      if (flat) {
        bucket = buckets[i] = compactBucket(bucket, true);
        const indexed = new THREE.BufferGeometry();
        indexed.setAttribute('position', new THREE.BufferAttribute(bucket.position, 3));
        if (bucket.indices) indexed.setIndex(new THREE.BufferAttribute(bucket.indices, 1));
        indexed.computeVertexNormals(); bucket.normal = indexed.getAttribute('normal').array as Float32Array;
      }
      for (const array of [bucket.position, bucket.color, bucket.uv, bucket.building, bucket.layer, bucket.normal!]) transfer.push(array.buffer as ArrayBuffer);
      if (bucket.indices) transfer.push(bucket.indices.buffer as ArrayBuffer);
    }
    scope.postMessage({id: data.id, buckets}, transfer);
  } catch (error) { scope.postMessage({id: data.id, error: String(error)}); }
};
