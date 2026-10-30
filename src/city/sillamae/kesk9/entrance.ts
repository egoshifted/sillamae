import * as THREE from 'three';
import {design,type Opening} from './design.ts';

export const detailedEntrance='WNW-S4-door';

export function entranceMaterials(masonry:THREE.Texture[]) {
  const jamb=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 brick jambs',color:'#c8a58a',roughness:1,map:masonry[0],bumpMap:masonry[1],bumpScale:.016});
  const leaf=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 dark door',color:'#382425',roughness:.88});
  const trim=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 dark trim',color:'#272a25',roughness:.84});
  const hardware=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 lever',color:'#b2b1a6',roughness:.45,metalness:.5});
  const access=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 access unit',color:'#242a27',roughness:.8});
  const lamp=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 canopy light',color:'#bbc2b4',roughness:.85});
  const canvas=typeof window==='undefined'?null:document.createElement('canvas');
  if(canvas){canvas.width=128;canvas.height=80;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f3f2e8';ctx.fillRect(0,0,128,80);ctx.fillStyle='#263130';ctx.font='bold 31px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('21–40',64,43);}
  const texture=canvas?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([243,242,232,255]),1,1);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const plaque=new THREE.MeshStandardMaterial({name:'Kesk 9 · 21–40 entrance plaque',color:'#ffffff',roughness:.9,map:texture});
  for(const m of [hardware,access,lamp,plaque])m.userData.detailAddition=true;
  return {jamb,leaf,trim,hardware,access,lamp,plaque};
}

export function addEntranceFittings(root:THREE.Group,o:Opening,m:ReturnType<typeof entranceMaterials>) {
  const exterior=-design.width/2,features:{name:string;bounds:number[][]}[]=[];
  function add(geometry:THREE.BufferGeometry,material:THREE.MeshStandardMaterial,name:string) {
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    geometry.computeBoundingBox();features.push({name,bounds:[geometry.boundingBox!.min.toArray(),geometry.boundingBox!.max.toArray()]});
  }
  function box(x:number,y:number,depth:number,w:number,h:number,d:number,material:THREE.MeshStandardMaterial,name:string) {
    const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,exterior+depth);add(g,material,name);
  }
  // The approved opaque leaf's exterior is 0.221 m inside the masonry plane.
  box(o.x+.075,1.60,.211,.025,.13,.020,m.hardware,'21-40-handle-backplate');
  box(o.x+.075,1.60,.1905,.016,.025,.021,m.hardware,'21-40-handle-neck');
  box(o.x+.115,1.60,.180,.09,.018,.018,m.hardware,'21-40-handle-lever');
  box(o.x-.075,1.87,.211,.085,.20,.020,m.access,'21-40-access-unit');
  const light=new THREE.CylinderGeometry(.045,.045,.024,12);light.translate(o.x,2.608,exterior-.42);
  add(light,m.lamp,'21-40-canopy-light');
  box(o.x-.43,2.36,.2195,.22,.14,.003,m.lamp,'21-40-plaque-backing');
  const face=new THREE.PlaneGeometry(.22,.14);face.rotateY(Math.PI);face.translate(o.x-.43,2.36,exterior+.217);
  add(face,m.plaque,'21-40-plaque-text');
  return features;
}
