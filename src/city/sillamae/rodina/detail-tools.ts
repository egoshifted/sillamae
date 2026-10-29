import * as THREE from 'three';
import {facadePoint} from './shell.ts';
import type {Face, Feature, ModelOptions} from './types.ts';

export function detailBuilder(materials: Record<string,THREE.MeshStandardMaterial>,{compact=false}: ModelOptions={}){
 const pieces: {name: string; geometry: THREE.BufferGeometry; material: string}[]=[],features: Feature[]=[];
 function add(name: string,g: THREE.BufferGeometry,material: string,face: Face | null=null){
  let geom=g.index?g.toNonIndexed():g.clone();g.dispose();
  if(face){const p=geom.attributes.position,normal=geom.attributes.normal,origin=facadePoint(face,0,0,0),a=facadePoint(face,1,0,0).map((v,i)=>v-origin[i]),n=facadePoint(face,0,0,1).map((v,i)=>v-origin[i]),det=a[0]*n[2]-a[2]*n[0];
   for(let i=0;i<p.count;i++){const q=facadePoint(face,p.getX(i),p.getY(i),p.getZ(i));p.setXYZ(i,...q);const x=normal.getX(i),y=normal.getY(i),z=normal.getZ(i);normal.setXYZ(i,a[0]*x+n[0]*z,y,a[2]*x+n[2]*z);}
   if(det<0)for(const attr of [p,normal]){const array=attr.array;for(let i=0;i<array.length;i+=9)for(let k=0;k<3;k++){const t=array[i+3+k];array[i+3+k]=array[i+6+k];array[i+6+k]=t;}}
  }
  const p=geom.attributes.position,n=geom.attributes.normal,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const a=Math.abs(n.getX(i)),b=Math.abs(n.getY(i)),c=Math.abs(n.getZ(i));uv[i*2]=b>a&&b>c?p.getX(i):a>c?p.getZ(i):p.getX(i);uv[i*2+1]=b>a&&b>c?p.getZ(i):p.getY(i);}
  geom.setAttribute('uv',new THREE.BufferAttribute(uv,2));geom.computeBoundingBox();features.push({name,material,vertices:p.count,bounds:[geom.boundingBox!.min.toArray(),geom.boundingBox!.max.toArray()]});pieces.push({name,geometry:geom,material});return geom;
 }
 function box(name: string,a: number,b: number,y0: number,y1: number,d0: number,d1: number,material='trim',face: Face='NNE'){const g=new THREE.BoxGeometry(b-a,y1-y0,d1-d0);g.translate((a+b)/2,(y0+y1)/2,(d0+d1)/2);return add(name,g,material,face);}
 function shape(name: string,points: number[][],depth: number,offset: number,material='trim',face: Face='NNE',bevel=0){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});g.translate(0,0,offset);return add(name,g,material,face);}
 function line(name: string,points: number[][],r=.02,material='trim',face: Face='NNE',segments=8,sides=6){if(points.length<2)return;const p=points.map(p=>new THREE.Vector3(...p)),closed=p[0].distanceTo(p.at(-1)!)<1e-7;if(closed)p.pop();const curve=new THREE.CatmullRomCurve3(p,closed);return add(name,new THREE.TubeGeometry(curve,Math.max(Math.min(segments,compact?16:32),Math.min(p.length*(compact?1:2),compact?16:32)),r,compact?4:sides,closed),material,face);}
 function ring(name: string,x: number,y: number,rx: number,ry: number,d: number,r=.025,material='trim',face: Face='NNE',start=0,end=Math.PI*2){const count=Math.ceil((end-start)*(compact?3:5))+1,pts=Array.from({length:count},(_,i)=>{const t=start+(end-start)*i/(count-1);return[x+rx*Math.cos(t),y+ry*Math.sin(t),d];});return line(name,pts,r,material,face,pts.length,6);}
 function disk(name: string,x: number,y: number,r: number,depth: number,offset: number,material='trim',face: Face='NNE'){const s=new THREE.Shape();s.absarc(x,y,r,0,Math.PI*2,false);const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:16});g.translate(0,0,offset);return add(name,g,material,face);}
 function leaf(name: string,x: number,y: number,w: number,h: number,d: number,angle=0,material='trim',face: Face='NNE',lobes=3){
  const positions=[],ids=[],rows=compact?6:12,cols=compact?2:4,transform=(a: number,b: number,c: number)=>[x+a*Math.cos(angle)-b*Math.sin(angle),y+a*Math.sin(angle)+b*Math.cos(angle),c];
  for(let i=0;i<=rows;i++){const t=i/rows,width=w*Math.pow(Math.sin(Math.PI*t),.65)*(.88+.12*Math.cos(t*Math.PI*lobes*2));for(let j=0;j<=cols;j++){const u=j/cols*2-1;positions.push(...transform(u*width/2,t*h,d+.018+.035*t+.04*Math.sin(Math.PI*t)*(1-u*u)+.025*Math.pow(t,6)));}}
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const k=i*(cols+1)+j;if(i>0)ids.push(k,k+1,k+cols+2);if(i<rows-1)ids.push(k,k+cols+2,k+cols+1);}
  const count=positions.length/3,front=ids.slice();for(let i=0;i<count;i++){const q: number[]=positions.slice(i*3,i*3+3);q[2]=d;positions.push(...q);}for(let i=0;i<front.length;i+=3)ids.push(front[i]+count,front[i+2]+count,front[i+1]+count);
  for(let i=0;i<rows;i++)for(const j of [0,cols]){const a=i*(cols+1)+j,b=(i+1)*(cols+1)+j;if(j===0)ids.push(a,b,b+count,a,b+count,a+count);else ids.push(a,b+count,b,a,a+count,b+count);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(ids);g.computeVertexNormals();add(name,g,material,face);
  line(name+'-rib',Array.from({length:6},(_,i)=>{const t=i/5;return transform(0,t*h,d+.03+.08*Math.sin(Math.PI*t));}),.008,material,face,10,5);
 }
 function finish(root: THREE.Group){const groups=new Map<string,THREE.BufferGeometry[]>();for(const p of pieces){let list=groups.get(p.material);if(!list)groups.set(p.material,list=[]);list.push(p.geometry);}let triangles=0,bytes=0;
  for(const[key,list]of groups){const g=new THREE.BufferGeometry();for(const a of ['position','normal','uv']){const size=a==='uv'?2:3,values=new Float32Array(list.reduce((n,p)=>n+p.attributes[a].array.length,0));let offset=0;for(const p of list){values.set(p.attributes[a].array,offset);offset+=p.attributes[a].array.length;}g.setAttribute(a,new THREE.BufferAttribute(values,size));bytes+=values.byteLength;}list.forEach(g=>g.dispose());g.computeBoundingSphere();const m=new THREE.Mesh(g,materials[key]);m.name='rodina-detail-'+key;m.castShadow=m.receiveShadow=true;root.add(m);triangles+=g.attributes.position.count/3;}
  return{features,triangles,geometryBytes:bytes,batches:groups.size};
 }
 return{add,box,shape,line,ring,disk,leaf,finish,pieces,features};
}
