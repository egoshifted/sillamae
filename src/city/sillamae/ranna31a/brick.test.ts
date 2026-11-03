import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyBrick} from './brick.ts';
import {frontDesign as d,frontSchedule} from './front-design.ts';

test('pale front bands reach both scheduled window edges without covering the adjacent brick',()=>{
  const root=new THREE.Group(),plain=new THREE.MeshStandardMaterial({name:'plain-shell'}),brick=new THREE.MeshStandardMaterial();
  const wall=new THREE.Mesh(new THREE.BoxGeometry(7.6,10,.38),plain);wall.name='centre-front';wall.position.set(0,5,8);root.add(wall);
  applyBrick(root,brick);root.updateMatrixWorld(true);
  try {
    for(const x of d.centreColumns)for(const side of [-1,1]) {
      const width=frontSchedule().find(o=>o.kind==='window'&&o.group==='centre'&&o.x===x)!.width;
      for(const [inset,expected] of [[-.01,plain],[.01,brick]] as const) {
        const hit=new THREE.Raycaster(new THREE.Vector3(x+side*(width/2+inset),5,10),new THREE.Vector3(0,0,-1)).intersectObject(root,true)[0];
        assert.ok(hit);assert.equal((hit.object as THREE.Mesh).material,expected);
      }
    }
  } finally {root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});plain.dispose();brick.dispose();}
});
