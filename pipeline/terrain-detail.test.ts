import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK, canCoarsen, fineArea, perimeter} from './terrain-detail.ts';
import {polygonIndex} from './roads.ts';

test('coarse fans keep every shared metre-edge vertex and reject banks, water and colour boundaries', () => {
  const stride=BLOCK+1, points=Array.from({length:stride*stride},(_,k)=>({x:k%stride,z:Math.floor(k/stride),h:k%stride*.1,c:[.5,.6,.5]}));
  assert.equal(canCoarsen(points,0,0,stride),true);
  const edge=perimeter(0,0,stride); assert.equal(new Set(edge).size,4*BLOCK);
  for(let i=0;i<edge.length;i++) {const a=points[edge[i]],b=points[edge[(i+1)%edge.length]];assert.equal(Math.hypot(a.x-b.x,a.z-b.z),1);}
  points[40].h+=.3; assert.equal(canCoarsen(points,0,0,stride),false); points[40].h-=.3;
  points[40].c=[.8,.8,.8]; assert.equal(canCoarsen(points,0,0,stride),false);
  assert.equal(canCoarsen(points.map((p,i)=>i===40?null:p),0,0,stride),false);
});

test('town boundary and outlying building margins are protected independently', () => {
  const fine=fineArea([[0,0],[100,0],[100,100],[0,100]],[{minX:200,maxX:240,minZ:200,maxZ:240}]);
  assert.equal(fine(50,50),true); assert.equal(fine(110,50),true);
  assert.equal(fine(220,220),true); assert.equal(fine(150,150),false);
});

test('polygon filtering retains containing holes and stable ring order', () => {
  const outer:[number,number][]=[[-100,-100],[100,-100],[100,100],[-100,100]],hole:[number,number][]=[[-20,-20],[-20,20],[20,20],[20,-20]],remote:[number,number][]=[[200,200],[210,200],[210,210]];
  assert.deepEqual(polygonIndex([outer,hole,remote])([[0,0],[1,0],[1,1]]),[outer,hole]);
});
