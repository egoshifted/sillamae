import test from 'node:test';
import assert from 'node:assert/strict';
import {groundCandidates} from './ground-index.ts';
import {entranceDatum} from '../../studio/assembly/seat.ts';

test('indexed sampling retains stacked ground, tolerance-edge hits and broad triangles', () => {
  const ground: number[][] = [];
  for (let z = -12; z < 12; z++) for (let x = -12; x < 12; x++) for (const h of [10, 10.2]) {
    ground.push([x,z,h,x+1,z,h,x+1,z+1,h], [x,z,h,x+1,z+1,h,x,z+1,h]);
  }
  const sea = [-1000,-1000,0,1000,-1000,0,0,1000,0]; ground.push(sea);
  for (const [x,z] of [[0,0],[-4,4],[3.999999,4.000001],[11.9,11.9]]) {
    const hits = (triangles: number[][]) => triangles.filter(([ax,az,,bx,bz,,cx,cz]) => {
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz), a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      return Math.min(a,b,1-a-b)>=-1e-5;
    });
    assert.deepEqual(hits(groundCandidates(ground,x,z)),hits(ground));
    assert.equal(entranceDatum(ground,[[x,z]]),10);
    assert.ok(groundCandidates(ground,x,z).length < ground.length / 4);
  }
});
