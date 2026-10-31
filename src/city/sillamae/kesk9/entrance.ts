import * as THREE from 'three';
import {design,type Opening} from './design.ts';
import {canopy} from './model.ts';

export type LeafFinish='brown'|'red';
export interface EntranceSpec {door:string; stairwell:number; flats:string; leaf:LeafFinish; inferredLabel?:boolean; access?:boolean; lamp?:boolean; rail?:boolean; mailbox?:boolean}

// Stairwells count from the NNE end, against the SSW→NNE section order. Fittings are listed only where seen.
export const entrances:readonly EntranceSpec[]=[
  {door:'WNW-S1-door',stairwell:5,flats:'81–100',leaf:'red',inferredLabel:true,rail:true},
  {door:'WNW-S2-door',stairwell:4,flats:'61–80',leaf:'brown',inferredLabel:true},
  {door:'WNW-S3-door',stairwell:3,flats:'41–60',leaf:'red',access:true,rail:true,mailbox:true},
  {door:'WNW-S4-door',stairwell:2,flats:'21–40',leaf:'brown',inferredLabel:true,access:true,lamp:true,rail:true},
  {door:'WNW-S5-door',stairwell:1,flats:'1–20',leaf:'red',lamp:true},
];

export function entranceMaterials(masonry:THREE.Texture[]) {
  const material=(name:string,color:string,roughness:number,extra:THREE.MeshStandardMaterialParameters={})=>new THREE.MeshStandardMaterial({name:'Kesk 9 · '+name,color,roughness,...extra});
  const jamb=material('entrance brick jambs','#c8a58a',1,{map:masonry[0],bumpMap:masonry[1],bumpScale:.016});
  const leaf=material('dark door, brown','#382425',.88), redLeaf=material('dark door, red-brown','#4a2226',.88);
  const trim=material('entrance dark trim','#272a25',.84);
  const hardware=material('entrance lever','#b2b1a6',.45,{metalness:.5}), access=material('entrance access unit','#242a27',.8);
  const lamp=material('canopy light','#bbc2b4',.85), mailbox=material('entrance mailbox','#1f2427',.7,{metalness:.3});
  const railPost=material('handrail, grey paint','#7f8582',.7,{metalness:.3}), railBend=material('handrail, yellow paint','#c9a43a',.7,{metalness:.2});
  const flashing=material('canopy edge flashing','#5f6864',.55,{metalness:.45});
  for(const m of [hardware,access,lamp,mailbox,railPost,railBend,flashing])m.userData.detailAddition=true;
  const plaques=Object.fromEntries(entrances.map(e=>[e.door,plaqueMaterial(e)]));
  return {jamb,leaf,redLeaf,trim,hardware,access,lamp,mailbox,railPost,railBend,flashing,plaques};
}

function plaqueMaterial(e:EntranceSpec) {
  const canvas=typeof window==='undefined'?null:document.createElement('canvas');
  if(canvas){
    canvas.width=128;canvas.height=80;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#f3f2e8';ctx.fillRect(0,0,128,80);ctx.fillStyle='#263130';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='bold 20px "Times New Roman",serif';ctx.fillText(['I','II','III','IV','V'][e.stairwell-1],64,22,120);
    ctx.font='bold 28px Arial';ctx.fillText(e.flats,64,54,120);
  }
  const texture=canvas?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([243,242,232,255]),1,1);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const plaque=new THREE.MeshStandardMaterial({name:`Kesk 9 · entrance plaque ${e.flats}`,color:'#ffffff',roughness:.9,map:texture});
  plaque.userData.detailAddition=true;plaque.userData.plaque=true;
  return plaque;
}

export function leafMaterial(e:EntranceSpec,m:{leaf:THREE.MeshStandardMaterial;redLeaf:THREE.MeshStandardMaterial}) {
  return e.leaf==='red'?m.redLeaf:m.leaf;
}

export function addEntranceFittings(root:THREE.Group,o:Opening,e:EntranceSpec,m:ReturnType<typeof entranceMaterials>) {
  const exterior=-design.width/2,features:{name:string;bounds:number[][]}[]=[],prefix=e.flats.replace('–','-');
  function add(geometry:THREE.BufferGeometry,material:THREE.MeshStandardMaterial,name:string) {
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    geometry.computeBoundingBox();features.push({name,bounds:[geometry.boundingBox!.min.toArray(),geometry.boundingBox!.max.toArray()]});
  }
  function box(x:number,y:number,depth:number,w:number,h:number,d:number,material:THREE.MeshStandardMaterial,name:string) {
    const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,exterior+depth);add(g,material,name);
  }
  // The opaque leaf's exterior is 0.221 m inside the masonry plane.
  box(o.x+.075,1.60,.211,.025,.13,.020,m.hardware,prefix+'-handle-backplate');
  box(o.x+.075,1.60,.1905,.016,.025,.021,m.hardware,prefix+'-handle-neck');
  box(o.x+.115,1.60,.180,.09,.018,.018,m.hardware,prefix+'-handle-lever');
  if(e.access)box(o.x-.075,1.87,.211,.085,.20,.020,m.access,prefix+'-access-unit');
  if(e.mailbox)box(o.x+.30,1.91,.181,.19,.24,.08,m.mailbox,prefix+'-mailbox');
  if(e.lamp){const light=new THREE.CylinderGeometry(.045,.045,.024,12);light.translate(o.x,2.608,exterior-.42);add(light,m.lamp,prefix+'-canopy-light');}
  box(o.x-.43,2.36,.2195,.22,.14,.003,m.lamp,prefix+'-plaque-backing');
  const face=new THREE.PlaneGeometry(.22,.14);face.rotateY(Math.PI);face.translate(o.x-.43,2.36,exterior+.217);
  add(face,m.plaques[e.door],prefix+'-plaque-text');
  const t=.004, drop=.07, lap=.05, gap=.012, front=exterior-canopy.depth, top=canopy.centreY+canopy.thickness/2, half=canopy.width/2+gap+t;
  const sheet=(x:number,y:number,z:number,w:number,h:number,d:number,name:string)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m.flashing,prefix+'-flashing-'+name);};
  sheet(o.x,top-drop/2+t,front-gap-t/2,2*half,drop,t,'front');
  sheet(o.x,top+t/2,front+(lap-gap-t)/2,2*half,t,lap+gap+t,'front-top');
  for(const side of [-1,1]) {
    sheet(o.x+side*(half-t/2),top-drop/2+t,(front-gap+exterior)/2,t,drop,exterior-front+gap,side<0?'ssw-end':'nne-end');
    sheet(o.x+side*(half-(lap+gap+t)/2),top+t/2,(front+lap+exterior)/2,lap+gap+t,t,exterior-front-lap,side<0?'ssw-top':'nne-top');
  }
  if(e.rail) {
    const s=o.x+o.width/2+.18+.07, z=exterior-.12, r=.021, landing=.65, bend=1.20, top=1.35;
    const post=new THREE.CylinderGeometry(r,r,bend-landing,10);post.translate(s,(landing+bend)/2,z);add(post,m.railPost,prefix+'-rail-post');
    const upper=new THREE.CylinderGeometry(r,r,top-bend,10);upper.translate(s,(bend+top)/2,z);add(upper,m.railBend,prefix+'-rail-upper');
    const arm=new THREE.CylinderGeometry(r,r,exterior-z,10);arm.rotateX(Math.PI/2);arm.translate(s,top-r,(z+exterior)/2);add(arm,m.railBend,prefix+'-rail-arm');
  }
  return features;
}
