import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import type {Study} from '../kesk5/types.ts';
import {design as sister} from '../kesk5/config.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import {createOpenings} from './openings.ts';
import {finishSurfaces} from './finishes.ts';
import {balconies} from './balconies.ts';


function addressMap(text: string) {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=152;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#ebe9df';ctx.fillRect(0,0,256,152);ctx.fillStyle='#282b2b';
  ctx.font=text==='8'?'bold 136px Arial':'bold 48px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,83);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

export function createDetailed(context: OverrideContext) {
  const model=createOpenings(context,true),root=model.root as Study,audit=root.userData.audit;
  const finish=finishSurfaces(root),address=addressMap('8'),street=addressMap('Kajaka tn');
  const materials={
    light:new THREE.MeshStandardMaterial({color:0xd7d9d3,roughness:.72}),
    dark:new THREE.MeshStandardMaterial({color:0x6b5447,roughness:.84}),
    open:new THREE.MeshStandardMaterial({color:0x63816d,roughness:.86}),
    glass:new THREE.MeshStandardMaterial({color:0x9db0b1,transparent:true,opacity:.32,depthWrite:false,roughness:.38}),
    street:new THREE.MeshStandardMaterial({color:0xffffff,map:street,roughness:.8}),
    plaque:new THREE.MeshStandardMaterial({color:0xffffff,map:address,roughness:.8}),
  };
  const plan=audit.localFootprint;
  function frame(edge:number){
    const a=plan[edge],b=plan[(edge+1)%plan.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const group=new THREE.Group();group.position.set(a[0],0,a[1]);group.rotation.y=-Math.atan2(dz,dx);group.updateMatrix();
    return {matrix:group.matrix,length:Math.hypot(dx,dz)};
  }
  function part(edge:number,name:string,geometry:THREE.BufferGeometry,mat:THREE.MeshStandardMaterial,x:number,y:number,out:number) {
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,out);mesh.applyMatrix4(frame(edge).matrix);
    mesh.castShadow=mat!==materials.glass;mesh.receiveShadow=true;mesh.name=name;root.add(mesh);return mesh;
  }
  function box(edge:number,name:string,x:number,y:number,w:number,h:number,out:number,d:number,mat:THREE.MeshStandardMaterial){
    return part(edge,name,new THREE.BoxGeometry(w,h,d),mat,x+w/2,y+h/2,out);
  }
  for(const row of balconies.rows){
    const face=audit.facadeEdges.find(f=>f.type==='loggia'&&f.section===row.section)!;
    const o=audit.openings.find(v=>v.kind==='loggia'&&v.edge===face.edge&&v.floor===row.floor)!;
    const y=o.y+sister.loggiaParapet,h=o.h-sister.loggiaParapet-.12,bar=.045;
    let end=0;
    const rail=(from:number,to:number)=>box(face.edge,'open-balcony-rail',o.x+from*o.w,y,(to-from)*o.w,.035,-.06,.05,materials.open);
    for(const seg of row.segments){
      const x=o.x+seg.from*o.w,w=(seg.to-seg.from)*o.w,mat=seg.frame==='dark'?materials.dark:materials.light;
      if(seg.from>end)rail(end,seg.from);
      box(face.edge,'balcony-glazing',x,y,w,h,-.075,.025,materials.glass);
      for(const by of [y,y+h-bar])box(face.edge,'balcony-crossbar',x,by,w,bar,-.035,.05,mat);
      const panes=Math.max(1,Math.round(w/(seg.panePitch??.74)));
      for(let i=0;i<=panes;i++) {
        // Shared segment boundaries have a single post and remain inside the bay.
        if(i===0 && seg.from>0 && seg.from===end)continue;
        box(face.edge,'balcony-post',x+(w-bar)*i/panes,y+bar,bar,h-2*bar,-.035,.05,mat);
      }
      if(seg.cover)box(face.edge,'top-balcony-cover',x,y+h,w,.085,-sister.roofBalconySetback/2,sister.roofBalconySetback,materials.light);
      end=seg.to;
    }
    if(end<1)rail(end,1);
  }
  const vents=root.children.filter(m=>m.name==='roof-vent');
  for(const body of vents) {
    const {width,height,depth}=(body.geometry as THREE.BoxGeometry).parameters;
    const cap=new THREE.Mesh(new THREE.BoxGeometry(width+.055,.045,depth+.055),finish.coping);
    cap.name='vent-cap';cap.position.copy(body.position);cap.position.y+=height/2+.0225;
    cap.rotation.copy(body.rotation);cap.castShadow=cap.receiveShadow=true;root.add(cap);
  }
  const rear=audit.facadeEdges.find(f=>f.section===4&&f.type==='loggia')!.edge;
  const dishX=frame(rear).length*.055,dishY=sister.roofDatum-.4;
  box(rear,'dish-anchor',dishX-.075,dishY-.15,.15,.3,.03,.07,finish.coping);
  box(rear,'dish-bracket',dishX-.02,dishY-.025,.04,.05,.16,.26,finish.coping);
  const profile=[[0,-.015],[.15,.015],[.27,.075],[.27,.09],[.15,.03],[0,0]].map(([x,y])=>new THREE.Vector2(x,y));
  const dishGeometry=new THREE.LatheGeometry(profile,24);dishGeometry.rotateX(1.1);
  part(rear,'river-dish',dishGeometry,materials.light,dishX,dishY,.30);
  const endWall=(rear+1)%plan.length;
  const plaque=part(endWall,'address-8',new THREE.PlaneGeometry(.32,.20),materials.plaque,frame(endWall).length*.84,2.15,.008);
  plaque.castShadow=false;
  part(endWall,'street-address',new THREE.PlaneGeometry(.38,.115),materials.street,frame(endWall).length*.84,1.89,.008).castShadow=false;

  const opaque=new THREE.Group();
  for(const mesh of [...root.children])if(mesh instanceof THREE.Mesh && !(mesh instanceof THREE.InstancedMesh) && !mesh.material.transparent)opaque.add(mesh);
  batchDetailStudy(opaque);root.add(opaque);
  root.userData.detailReview={roofHousings:vents.length,balconyRows:balconies.rows.length,batched:opaque.userData.batchStats};
  return {...model,ready:finish.ready,setTextures(on:boolean){finish.toggle(on);materials.plaque.map=on?address:null;materials.plaque.needsUpdate=true;materials.street.map=on?street:null;materials.street.needsUpdate=true;},dispose(){
    model.dispose();finish.dispose();address?.dispose();street?.dispose();Object.values(materials).forEach(m=>m.dispose());
  }};
}
