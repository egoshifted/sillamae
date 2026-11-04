import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import {asset as spreading} from '../assets/shrub-spreading-01/asset.ts';
import {asset as rounded} from '../assets/shrub-rounded-01/asset.ts';
import {asset as lampPost} from '../assets/lamp-post-concrete-01/asset.ts';
import {createFrontStudy} from './front.ts';
import {sourcePoint} from './front-design.ts';
import {createAnnex} from './annex.ts';
import {createRearSite} from './site.ts';

export function createGarden(context:OverrideContext) {
  const building=createFrontStudy(context),root=new THREE.Group(),garden=new THREE.Group();root.add(building.root,garden);
  let masonry:THREE.MeshStandardMaterial|undefined;
  building.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial&&o.material.userData.surface==='kesk1-masonry-v1')masonry=o.material;});
  const annex=createAnnex(context,building.root.userData.audit.datum,masonry);annex.root.position.copy(building.root.position);annex.root.rotation.copy(building.root.rotation);root.add(annex.root);
  const site=createRearSite(context.ground,building.root.userData.audit.datum);site.root.position.copy(building.root.position);site.root.rotation.copy(building.root.rotation);root.add(site.root);
  garden.name='right-front-garden';garden.position.copy(building.root.position);garden.rotation.copy(building.root.rotation);
  // Plant origins meet the upper survey layer, whereas the foundation sampler selects the lowest one.
  const upperGround=context.ground.map(t=>t.map((v,i)=>i%3===2?-v:v));
  const foliage=new Map<THREE.Material,THREE.Material>();
  const patches=[
    {x:1.45,z:10.9,scale:[.7,.38,.7]}, {x:2.4,z:11.0,scale:[.8,.4,.7]},
    {x:3.4,z:11.1,scale:[.85,.42,.75]}, {x:4.5,z:11.0,scale:[.8,.4,.7]},
    {x:5.6,z:10.8,scale:[.7,.35,.65]}, {x:7.1,z:10.25,scale:[.55,.5,.55]},
    {x:8.7,z:10.0,scale:[.55,.55,.55]}, {x:10.5,z:9.7,scale:[.7,.55,.6]},
  ];
  // Owner Ranna photos: a clump of bushes at the tower's rear east corner, between the wall, the sidewalk and the footway to the front.
  // They stand about head high, much fuller than the low front hedge.
  const eastEnd=[{x:15.2,z:-8.6,scale:[2,1.5,1.8]},{x:16.9,z:-7,scale:[1.8,1.6,1.7]},{x:17.3,z:-5,scale:[1.7,1.4,1.5]}];
  for(const p of [...patches,...eastEnd,{x:1.8,z:10.1,scale:[.42,.36,.42],round:true},{x:11.9,z:9.5,scale:[.55,.62,.55],round:true},{x:14.6,z:-6.2,scale:[1.4,1.4,1.4],round:true}]) {
    const bush=('round' in p?rounded:spreading).build({variant:'summer',detail:'near'}),height=entranceDatum(upperGround,[sourcePoint(p.x,p.z)]);
    if(height===null)throw Error('Front garden needs survey land');
    bush.position.set(p.x,-height-context.frame.base-building.root.position.y,p.z);bush.scale.set(...p.scale as [number,number,number]);garden.add(bush);
    bush.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;
      const material=o.material;
      if(!(material instanceof THREE.MeshStandardMaterial||material instanceof THREE.MeshLambertMaterial)||!material.vertexColors)return;
      let local=foliage.get(material);if(!local){const tinted=material.clone();tinted.onBeforeCompile=material.onBeforeCompile;tinted.customProgramCacheKey=material.customProgramCacheKey;tinted.color.set('#b0c5b2');foliage.set(material,local=tinted);}o.material=local;
    });
  }
  // Owner Ranna photos: galvanised street lamps in the grass strip, one between the two lindens before the tower and one by the footway; arms reach over the road (−z).
  for(const [x,z] of [[3.5,-12.6],[20.8,-12.6]]) {
    const lamp=lampPost.build({variant:'metal',detail:'near'}),height=entranceDatum(upperGround,[sourcePoint(x,z)]);
    if(height===null)throw Error('Street lamp needs survey land');
    lamp.position.set(x,-height-context.frame.base-building.root.position.y,z);lamp.rotation.y=Math.PI;lamp.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=o.receiveShadow=true;});garden.add(lamp);
  }
  let disposed=false;
  return {...building,root,datum:building.root.userData.audit.datum as number,ready:Promise.all([building.ready,annex.ready]),setTextures(enabled:boolean){building.setTextures?.(enabled);annex.setTextures(enabled);site.setTextures(enabled);},groundCuts:[...(building.groundCuts??[]),...annex.groundCuts,...site.groundCuts],dispose(){if(disposed)return;disposed=true;building.dispose();annex.dispose();site.dispose();garden.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});foliage.forEach(m=>m.dispose());garden.removeFromParent();root.removeFromParent();}};
}
