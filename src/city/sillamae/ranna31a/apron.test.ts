import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFrontApron} from './apron.ts';
import {sourcePoint} from './front-design.ts';

test('front apron stays level with the entrance across both balconies, clears the landing and extends below land',()=>{
  const ground=[[[1140,620],[1230,620],[1230,700]],[[1140,620],[1230,700],[1140,700]]].flatMap(t=>[0,.2].map(lift=>t.flatMap(([x,z])=>[x,z,8+lift+.03*(x-1190)+.02*(z-660)])));
  ground.push([0,0,0,2000,0,0,2000,2000,0]);
  const landing=[[-3.45,7.67],[.15,7.67],[.15,9.7],[.85,10.55],[-4.15,10.55],[-3.45,9.7]];
  const apron=createFrontApron(ground,8,[landing]),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(apron.geometry,material);
  mesh.updateMatrixWorld();
  const hit=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
  try {
    for(const [x,z] of [[-10,5.9],[-6.9,8],[-5,9.9],[5,9.9],[6.9,8],[10,5.9],[2,8.4]]) {
      const contact=hit(x,z);assert.ok(contact,`missing apron at ${x},${z}`);
      assert.ok(Math.abs(contact.point.y-.36)<1e-5,'apron must share the landing level without local humps');
    }
    for(const [x,z] of [[-1.65,8.4],[-5,10.5],[5,9.3],[10,5.3]])assert.equal(hit(x,z),undefined,'apron overlaps entrance, building or grass');
    const [sx,sz]=sourcePoint(5,10.2),low=.03*(sx-1190)+.02*(sz-660);
    const side=new THREE.Raycaster(new THREE.Vector3(5,Math.min(.35,low-.05),11),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
    assert.ok(side,'exposed apron edge stops above the lowest ground layer');
  } finally {apron.geometry.dispose();material.dispose();}
});
