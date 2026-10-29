import * as THREE from 'three';
import {accessDesign,addAccess,exitLevel} from './access.ts';
import {addShell} from './shell.ts';
import {addRodinaServices} from './services.ts';
import type {Feature, MeshGroup, ModelMesh, Opening} from './types.ts';

interface PlainRodina extends MeshGroup {
 userData: {audit: {
  stage: string; dimensions: typeof dimensions;
  frontOpenings: typeof frontOpenings; gardenOpenings: typeof gardenOpenings; courtyardOpenings: typeof courtyardOpenings;
  access: ReturnType<typeof addAccess>; architecture: ReturnType<typeof addShell>; services: ReturnType<typeof addRodinaServices>;
  features: Feature[]; triangles: number; geometryBytes: number; materials: number; ground: string; limits: string;
 }};
}

type Wing = {u: number[]; v: number[]; eave: number; ridge: number; ridgeU?: number; ridgeV?: number};

export const dimensions={main:{u:[0,21.4],v:[0,21.65],eave:10,ridge:13.8,ridgeU:11.3,ridgeV:10.95},westWing:{u:[-23.92,0],v:[3.93,17.43],eave:7.3,ridge:9.95,ridgeV:10.78},southWing:{u:[3.95,17.8],v:[21.65,45.47],eave:7.3,ridge:9.95,ridgeU:11.15},datum:14.5};

const observedGardenLayout=[
 {id:'NNE-D1',x:8.35,w:1.15,b:.7,t:4.1,type:'door'},
 {id:'NNE-D2',x:10.7,w:1.85,b:.7,t:4.1,type:'door'},
 {id:'NNE-D3',x:13.05,w:1.15,b:.7,t:4.1,type:'door'},
 {id:'NNE-L2-C1',x:8.1,w:1.05,b:6.05,t:8.45,type:'window'},
 {id:'NNE-L2-C2',x:10.7,w:2.15,b:6.05,t:8.45,type:'window'},
 {id:'NNE-L2-C3',x:13.3,w:1.05,b:6.05,t:8.45,type:'window'},
 ...[2.15,19.25].flatMap((x,i)=>[
  {id:`NNE-B${i+1}`,x,w:1.8,b:.05,t:1.5,type:'basement'},
  {id:`NNE-L1-S${i+1}`,x,w:1.7,b:3.1,t:5.25,type:'window'},
  {id:`NNE-L2-S${i+1}`,x,w:1.7,b:7,t:8.45,type:'window'}
 ])
];
export const gardenOpenings=observedGardenLayout.map(o=>({...o,id:o.id.replace('NNE','ESE'),x:o.x+.15,b:o.type==='basement'?.12:o.b}));
export const frontOpenings=observedGardenLayout.filter(o=>!o.id.includes('-B')&&!o.id.includes('L1-S'));
export const courtyardOpenings={WNW:[{id:'COURT-WNW-D1',x:1.75,w:.95,b:.95,t:3.2,type:'door'},{id:'COURT-WNW-W1',x:1.75,w:1,b:5.5,t:7.3,type:'window'}],SSW:[{id:'COURT-SSW-W1',x:18.4,w:1.05,b:2.65,t:4.15,type:'window'},{id:'COURT-SSW-D1',x:18.4,w:.95,b:5.25,t:7.45,type:'door'}]};

export function createRodina(){
 const root=new THREE.Group() as PlainRodina;root.name='rodina-plain-study';
 const wall=new THREE.MeshStandardMaterial({color:0xb9c3c8,roughness:1}),roof=new THREE.MeshStandardMaterial({color:0x8497a3,roughness:1,flatShading:true}),infill=new THREE.MeshStandardMaterial({color:0x465d68,roughness:1}),frame=new THREE.MeshStandardMaterial({color:0x8399a5,roughness:1}),step=new THREE.MeshStandardMaterial({color:0xa9b4bb,roughness:1});
 function mesh(name: string,points: number[][],indices: number[],material: THREE.MeshStandardMaterial){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 function block(name: string,x0: number,x1: number,y0: number,y1: number,z0: number,z1: number,material=wall){const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),material);m.name=name;m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 function entranceFace(name: string,openings: Opening[],width: number,start=0,{height=10,pilasters=true}={}){
  const first=root.children.length;
  const shape=new THREE.Shape();shape.moveTo(start,-2);shape.lineTo(width,-2);shape.lineTo(width,height);shape.lineTo(start,height);shape.closePath();
  for(const o of openings){const a=o.x-o.w/2,b=o.x+o.w/2,hole=new THREE.Path();hole.moveTo(a,o.b);hole.lineTo(a,o.t);hole.lineTo(b,o.t);hole.lineTo(b,o.b);hole.closePath();shape.holes.push(hole);}
  const masonry=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.4,steps:1,bevelEnabled:false}),wall);masonry.name=name+'-wall';masonry.castShadow=masonry.receiveShadow=true;root.add(masonry);
  for(const o of openings){
   const a=o.x-o.w/2,b=o.x+o.w/2;
   block(o.id+'-backing',a,b,o.b,o.t,.34,.4,infill);
   for(const [name,x0,x1,y0,y1]of [['left',a,a+.065,o.b,o.t],['right',b-.065,b,o.b,o.t],['head',a+.065,b-.065,o.t-.065,o.t],['sill',a+.065,b-.065,o.b,o.b+.065]] as const)block(o.id+'-'+name,x0,x1,y0,y1,.22,.34,frame);
   if(o.type==='well'){
    for(let i=1;i<=6;i++){const x=a+o.w*i/7;block(o.id+'-grille-vertical',x-.012,x+.012,o.b+.065,o.t-.065,.12,.15,frame);}
    for(const f of [.28,.65]){const y=o.b+(o.t-o.b)*f;block(o.id+'-grille-horizontal',a+.065,b-.065,y-.016,y+.016,.12,.15,frame);}
   }
  }
  if(pilasters)for(const x of [4.15,5.55,15.85,17.25])block(name+'-pilaster',x-.38,x+.38,-.15,7.9,-.22,0);
  const face=new THREE.Group();face.name=name+'-assembly';face.add(...root.children.slice(first));root.add(face);return face;
 }
 function wingWalls(name: string,d: Wing,along: string){
  const[x0,x1]=d.u,[z0,z1]=d.v,h=d.eave;
  if(along==='u'){
   const exitN=accessDesign.exits[0],exitS=accessDesign.exits[1];
   const north=entranceFace('WNW-wing-NNE',[{id:exitN.id,x:exitN.centre-x0,w:1.1,b:exitLevel(exitN),t:exitLevel(exitN)+2.35,type:'door'}],x1-x0,0,{height:h,pilasters:false});north.position.set(x0,0,z0);
   const south=entranceFace('WNW-wing-SSW',[{id:exitS.id,x:-exitS.centre,w:1.1,b:exitLevel(exitS),t:exitLevel(exitS)+2.35,type:'door'}],x1-x0,0,{height:h,pilasters:false});south.rotation.y=Math.PI;south.position.set(0,0,z1);
   block(name+'-end-wall',x0,x0+.4,-2,h,z0+.4,z1-.4);
   block(name+'-floor',x0+.4,x1,-2,-1.8,z0+.4,z1-.4);
  }else{
   const exit=accessDesign.exits[2],east=entranceFace('SSW-wing-ESE',[{id:exit.id,x:exit.centre-z0,w:1.1,b:exitLevel(exit),t:exitLevel(exit)+2.35,type:'door'}],z1-z0,0,{height:h,pilasters:false});east.rotation.y=-Math.PI/2;east.position.set(x1,0,z0);
   block(name+'-WNW-wall',x0,x0+.4,-2,h,z0,z1);
   const w=accessDesign.well,end=entranceFace('SSW-wing-end',w.windowCentres.map((x,i)=>({id:'WELL-B'+(i+1),x:x1-.4-x,w:w.width,b:w.sill,t:w.head,type:'well'})),x1-x0-.8,0,{height:h,pilasters:false});end.rotation.y=Math.PI;end.position.set(x1-.4,0,z1);
   block(name+'-floor',x0+.4,x1-.4,-2,-1.8,z0,z1-.4);
  }
 }
 function gableWing(name: string,d: Wing,along: string){const[x0,x1]=d.u,[z0,z1]=d.v,h=d.eave,r=d.ridge;wingWalls(name,d,along);
  if(along==='u'){const mid=d.ridgeV!;mesh(name+'-gable-end',[[x0,h,z0],[x0,h,z1],[x0,r,mid]],[0,1,2],wall);mesh(name+'-roof',[[x0,h,z0],[x1,h,z0],[x1,r,mid],[x0,r,mid],[x0,h,z1],[x1,h,z1]],[0,3,2,0,2,1,3,4,5,3,5,2],roof);}
  else{const mid=d.ridgeU!;mesh(name+'-gable-end',[[x0,h,z1],[x1,h,z1],[mid,r,z1]],[0,1,2],wall);mesh(name+'-roof',[[x0,h,z0],[x0,h,z1],[mid,r,z1],[mid,r,z0],[x1,h,z0],[x1,h,z1]],[0,1,2,0,2,3,3,2,5,3,5,4],roof);}
 }
 const d=dimensions.main,[x0,x1]=d.u,[z0,z1]=d.v,h=d.eave,r=d.ridge,x=d.ridgeU,z=d.ridgeV;
 entranceFace('NNE',frontOpenings,21.4);
 const garden=entranceFace('ESE',gardenOpenings,21.65,.4);garden.rotation.y=-Math.PI/2;garden.position.x=21.4;
 const courtW=entranceFace('COURT-WNW',courtyardOpenings.WNW,z1-.4,0,{pilasters:false});courtW.rotation.y=Math.PI/2;courtW.position.set(0,0,z1);
 const courtS=entranceFace('COURT-SSW',courtyardOpenings.SSW,x1-.8,0,{pilasters:false});courtS.rotation.y=Math.PI;courtS.position.set(x1-.4,0,z1);
 block('COURT-corner-WNW',-.22,0,-2,7.9,20.65,21.65);
 block('COURT-corner-SSW',0,1,-2,7.9,21.65,21.87);
 block('pavilion-floor',x0+.4,x1-.4,-2,-1.8,.4,z1-.4);
 const edge=[[[x0,h,z0],[x1,h,z0],[x,r,z0]],[[x1,h,z0],[x1,h,z1],[x1,r,z]],[[x1,h,z1],[x0,h,z1],[x,r,z1]],[[x0,h,z1],[x0,h,z0],[x0,r,z]]];
 edge.forEach((p,i)=>mesh('pavilion-gable-'+i,p,[0,2,1],wall));
 const corners=[[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]],peaks=[[x,r,z0],[x1,r,z],[x,r,z1],[x0,r,z]],centre=[x,r,z];
 for(let i=0;i<4;i++){
  const j=(i+1)%4;
  mesh('cross-roof-'+i,[corners[j],peaks[i],centre,peaks[j]],[0,1,2,0,2,3],roof);
 }
 gableWing('WNW-auditorium',dimensions.westWing,'u');gableWing('SSW-auditorium',dimensions.southWing,'v');
 const access=addAccess(block,{wall,step,guard:frame});
 const architecture=addShell(block,mesh,{wall,frame,infill});
 const services=addRodinaServices(block,mesh,{wall,frame,infill});
 root.updateMatrixWorld(true);
 const groups=new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>(),features: Feature[]=[];
 const roots=new Map([['WNW-wing-NNE-wall',[0,0]],['WNW-wing-SSW-wall',[0,0]],['WNW-auditorium-floor',[0,0]],['SSW-wing-ESE-wall',[2,21.65]],['SSW-auditorium-WNW-wall',[2,21.65]],['SSW-auditorium-floor',[2,21.65]]]);
 root.traverse(m=>{
  if(!(m as ModelMesh).isMesh)return;let g=(m as ModelMesh).geometry.index?(m as ModelMesh).geometry.toNonIndexed():(m as ModelMesh).geometry.clone();g.applyMatrix4(m.matrixWorld);
  // These root caps are buried against the owning pavilion wall and otherwise coincide with it.
  if(roots.has(m.name)){
   const[axis,value]=roots.get(m.name)!,a=g.attributes.position.array,keep=[];
   for(let i=0;i<a.length;i+=9)if(![0,3,6].every(j=>Math.abs(a[i+j+axis]-value)<1e-5))keep.push(i);
   const trimmed=new THREE.BufferGeometry();for(const attr of ['position','normal']){const source=g.attributes[attr].array,values=new Float32Array(keep.length*9);keep.forEach((i,j)=>values.set(source.slice(i,i+9),j*9));trimmed.setAttribute(attr,new THREE.BufferAttribute(values,3));}g.dispose();g=trimmed;
  }
  let parts=groups.get((m as ModelMesh).material);if(!parts)groups.set((m as ModelMesh).material,parts=[]);parts.push(g);features.push({name:m.name,vertices:g.attributes.position.count,material:(m as ModelMesh).material===wall?'shell':(m as ModelMesh).material===roof?'roof':(m as ModelMesh).material===frame?'frames':(m as ModelMesh).material===step?'access':'backings'});(m as ModelMesh).geometry.dispose();
 });
 root.clear();let triangles=0,geometryBytes=0;
 for(const[material,parts]of groups){const g=new THREE.BufferGeometry();for(const attr of ['position','normal']){const values=new Float32Array(parts.reduce((n,p)=>n+p.attributes[attr].array.length,0));let offset=0;for(const p of parts){values.set(p.attributes[attr].array,offset);offset+=p.attributes[attr].array.length;}g.setAttribute(attr,new THREE.BufferAttribute(values,3));geometryBytes+=values.byteLength;}parts.forEach(p=>p.dispose());const m=new THREE.Mesh(g,material);m.name='rodina-'+(material===wall?'shell':material===roof?'roof':material===frame?'frames':material===step?'access':'backings');m.castShadow=m.receiveShadow=true;root.add(m);triangles+=g.attributes.position.count/3;}
 root.userData.audit={stage:'plain-shape-roof-services',dimensions,frontOpenings,gardenOpenings,courtyardOpenings,access,architecture,services,features,triangles,geometryBytes,materials:groups.size,ground:'Local DTM terrain; real cutout for SSW-end well. No production survey changes.',limits:'Rodina-only unique building. All access, shell and service dimensions inferred. Well access, concealed courtyard bay, exact terminal/pipe profiles and architectural approval unresolved.'};
 return root;
}
