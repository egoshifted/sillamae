import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createBrickTexture,acquirePaleMasonry} from './masonry.ts';
import {createEntranceDetailStudy} from '../kesk5/entrance-detail.ts';
import {design} from '../kesk5/config.ts';

test('extracted masonry preserves the original four texture byte streams and settings',()=>{
  const expected=['74378c227f4ff4ac3288c0c716cce9870357470e43fe62573aed8989723eb973','d2ef68196a5289f22b3eedd605056433f8b800d2ef57297fa4d8e5c34c8ceae5','0a23161a3da102813e97b6a4fce8f8f0dd6f4f2d89b7328f4162f3748f60f534','d2ef68196a5289f22b3eedd605056433f8b800d2ef57297fa4d8e5c34c8ceae5'];
  let i=0;
  for(const red of [false,true])for(const relief of [false,true]){
    const t=createBrickTexture(red,relief);
    assert.equal(createHash('sha256').update(t.image.data).digest('hex'),expected[i++]);
    assert.equal(t.flipY,false);assert.equal(t.colorSpace,relief?'':THREE.SRGBColorSpace);
    assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.wrapT,THREE.RepeatWrapping);
    assert.equal(t.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(t.magFilter,THREE.LinearFilter);
    assert.equal(t.generateMipmaps,true);assert.equal(t.anisotropy,8);
    assert.deepEqual(t.userData.sharedSurface,red?{key:'masonry-v1',index:relief?1:0}:undefined);
    t.dispose();
  }
});

test('pale masonry is shared and only the last owner disposes it, with idempotent release',()=>{
  const a=acquirePaleMasonry(),b=acquirePaleMasonry();assert.equal(a.maps,b.maps);
  let disposed=0;for(const t of a.maps)t.addEventListener('dispose',()=>disposed++);
  a.release();a.release();assert.equal(disposed,0);b.release();b.release();assert.equal(disposed,2);
  const fresh=acquirePaleMasonry();assert.notEqual(fresh.maps,a.maps);fresh.release();
});

test('unloading the existing Kesk 5 consumer retains textures borrowed by a different owner',()=>{
  const external=acquirePaleMasonry(),model=createEntranceDetailStudy(design);
  assert.ok(model.children.some(m=>m.material.map===external.maps[0]&&m.material.bumpMap===external.maps[1]));
  let disposed=0;for(const t of external.maps)t.addEventListener('dispose',()=>disposed++);
  model.userData.dispose();assert.equal(disposed,0);
  external.release();assert.equal(disposed,2);
});
