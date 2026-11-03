import {finishSlabRoof} from '../shared/slab-roof.ts';
import {design as sister} from '../kesk5/config.ts';
import * as THREE from 'three';
import {surfaces} from '../kesk5/surfaces.ts';
import {acquirePaleMasonry} from '../shared/masonry.ts';
import {panelTexture, roughcast} from '../shared/slab-surfaces.ts';
import type {ModelMesh, Study} from '../kesk5/types.ts';

export function finishSurfaces(root: Study) {
  const shared = surfaces(), pale = acquirePaleMasonry();
  const panel = panelTexture(), concrete = roughcast(), relief = roughcast(true);
  const material = (map: THREE.Texture, bumpMap?: THREE.Texture, bumpScale = .018) =>
    new THREE.MeshStandardMaterial({map, bumpMap: bumpMap ?? null, bumpScale, roughness: .94});
  const white = material(pale.maps[0],pale.maps[1]), red = material(shared.masonry[0],shared.masonry[1]);
  const base = material(concrete,relief,.025), felt = material(shared.roof[0],shared.roof[1],.012);
  red.color.setHex(0xb77858); felt.color.setHex(0x8c908b);
  const ribs = material(panel), coping = new THREE.MeshStandardMaterial({color:0xa2a5a0,roughness:.78,metalness:.18});
  const vent = new THREE.MeshStandardMaterial({color:0xa6aaa5,roughness:.89});
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  function uv(mesh: ModelMesh, u: number, v: number, w: number, h: number, horizontal = false) {
    const g = mesh.geometry, coords = g.attributes.uv;
    mesh.updateMatrix();
    for (let i=0;i<coords.count;i++) {
      p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(mesh.matrix);
      n.fromBufferAttribute(g.attributes.normal,i).transformDirection(mesh.matrix);
      const along = p.x*u+p.z*v, across = -p.x*v+p.z*u;
      const side = Math.abs(n.x*u+n.z*v)>.7;
      coords.setXY(i,(side ? across : along)/w,(horizontal || Math.abs(n.y)>.7 ? across : p.y)/h);
    }
    coords.needsUpdate = true;
  }
  for (const mesh of root.children) {
    if (!(mesh instanceof THREE.Mesh) || mesh.userData.lintelPart) continue;
    const wall = /^(?:wall|shared-return)-(\d+)$/.exec(mesh.name);
    if (wall) {
      const edge=Number(wall[1]),plan=root.userData.audit.localFootprint,a=plan[edge],b=plan[(edge+1)%plan.length];
      const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
      const brickEnd=edge%2===1 || mesh.material.color.getHex()===0xbdb7ac || mesh.name.startsWith('shared-return');
      const jamb = edge < 7 && edge % 2 === 0 && Math.abs((mesh.position.x-a[0])*dx/l + (mesh.position.z-a[1])*dz/l - l/2) < 1.1;
      mesh.material=mesh.userData.basePart ? (jamb ? red : base) : brickEnd ? red : white;
      uv(mesh,dx/l,dz/l,mesh.material===base?2:2.2,mesh.material===base?2:.996);
    } else if (mesh.name==='roof') {
      mesh.material=felt; uv(mesh,1,0,16,16,true);
    } else if (mesh.name.startsWith('backing-') && mesh.name.endsWith('-foundation-recess') || mesh.name.startsWith('lightwell-') || mesh.name==='foundation-recess-cheek' || mesh.name==='landing') {
      mesh.material=base; uv(mesh,Math.cos(mesh.rotation.y),-Math.sin(mesh.rotation.y),2,2);
    } else if (mesh.name==='loggia-parapet') {
      mesh.material=ribs;
      const pos=mesh.geometry.attributes.position,coords=mesh.geometry.attributes.uv;
      const {width,height}=(mesh.geometry as THREE.BoxGeometry).parameters;
      for(let i=0;i<coords.count;i++)coords.setXY(i,pos.getX(i)+width/2,(pos.getY(i)+height/2)/height);
      coords.needsUpdate=true;
    } else if (mesh.name.startsWith('parapet-') || mesh.name.startsWith('roof-divider-')) {
      mesh.material=coping;
    } else if(mesh.name==='roof-vent') {
      mesh.material=vent;
    }
  }
  const position=root.position.clone(),rotation=root.quaternion.clone();
  root.position.set(0,0,0);root.quaternion.identity();
  try {
    finishSlabRoof(root,sister,{red,roofFinish:felt,roofEdgeMetal:coping},'Kajaka 8 aerial rim and Street View ends; folded edge dimensions inferred');
  } finally {
    root.position.copy(position);root.quaternion.copy(rotation);root.updateMatrixWorld(true);
  }
  const textured=[white,red,base,felt,ribs].map(m=>({m,map:m.map,bump:m.bumpMap}));
  return {coping, ready:shared.ready, toggle(on:boolean){
    for(const {m,map,bump} of textured){m.map=on?map:null;m.bumpMap=on?bump:null;m.needsUpdate=true;}
  },dispose(){
    for(const m of [white,red,base,felt,ribs,coping,vent])m.dispose();
    panel.dispose();concrete.dispose();relief.dispose();pale.release();
  }};
}
