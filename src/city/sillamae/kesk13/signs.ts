import * as THREE from 'three';
import {wallCorners} from './cornice.ts';
import {baseElevation} from './design.ts';

export function makeAddressSigns(centre: readonly number[]) {
 const walls=wallCorners(),a=walls[7],b=walls[0],length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,c=length-1.48;
 const textures:THREE.Texture[]=[],meshes:THREE.Mesh[]=[];
 for(const [id,label,width,height,y] of [['number','13',.48,.31,18.705],['street','KESK tn.',.76,.29,18.275]] as const) {
  let map:THREE.Texture;
  if(typeof document!=='undefined') {
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(768*height/width);
   const ctx=canvas.getContext('2d')!;ctx.fillStyle='#dadcd4';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.strokeStyle='#92988e';ctx.lineWidth=5;ctx.strokeRect(4,4,canvas.width-8,canvas.height-8);
   ctx.fillStyle='#182027';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(id==='number'?'700 ':'400 ')+Math.round(canvas.height*(id==='number'?.76:.52))+'px Arial, sans-serif';
   ctx.fillText(label,canvas.width/2,canvas.height*.53,canvas.width*.86);
   for(const x of [13,canvas.width-13])for(const yy of [13,canvas.height-13]){ctx.fillStyle='#777b70';ctx.beginPath();ctx.arc(x,yy,3,0,Math.PI*2);ctx.fill();}
   map=new THREE.CanvasTexture(canvas);
  } else {map=new THREE.DataTexture(new Uint8Array([218,220,212,255]),1,1);map.needsUpdate=true;}
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;textures.push(map);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map,roughness:.94}));
  mesh.name=id==='number'?'Printed number 13':'Printed KESK tn. plaque';mesh.userData.id='kesk13/address/'+id;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(uz,0,-ux));
  mesh.position.set(a[0]+ux*c+uz*.015-centre[0],y-baseElevation,a[1]+uz*c-ux*.015-centre[1]);mesh.receiveShadow=true;meshes.push(mesh);
 }
 return {meshes,dispose(){for(const m of meshes){m.geometry.dispose();(m.material as THREE.Material).dispose();}textures.forEach(t=>t.dispose());}};
}
