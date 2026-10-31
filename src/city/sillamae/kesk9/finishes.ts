import * as THREE from 'three';
import {createBuilding} from './model.ts';
import {design} from './design.ts';
import {correctedOpeningSchedule,openingHalves,openingRows} from './windows.ts';
import {paneFrame} from './joinery.ts';
import {surfaces} from '../kesk1/surfaces.ts';
import {acquirePaleMasonry} from '../shared/masonry.ts';
import {detailedEntrance,entranceMaterials,addEntranceFittings} from './entrance.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';

export const coping={height:.20,projection:.055};

interface Vertex {p: number[]; n: number[]}
type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

// Material regions partition the existing shell; overlays would reopen the seam defects.
function clip(poly: Vertex[], distance: (v: Vertex) => number, inside = true): Vertex[] {
  const result: Vertex[] = [];
  for (let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length], da=distance(a), db=distance(b);
    const ai=inside?da>=0:da<0, bi=inside?db>=0:db<0;
    if(ai)result.push(a);
    if(ai!==bi) { const t=da/(da-db); result.push({p:a.p.map((v,j)=>v+(b.p[j]-v)*t),n:a.n.map((v,j)=>v+(b.n[j]-v)*t)}); }
  }
  return result;
}

export function createFinishes(context: OverrideContext): StudyModel {
  const schedule=correctedOpeningSchedule(), plain=createBuilding(context,schedule), root=plain.root as THREE.Group, shared=surfaces(), pale=acquirePaleMasonry();
  const material=(name: string, color: string, roughness=1) => new THREE.MeshStandardMaterial({name,color,roughness});
  const door=schedule.find(o=>o.id===detailedEntrance)!, entry=entranceMaterials(shared.maps['masonry-v1']);
  const plaqueTexture=entry.plaque.map;
  const materials={
    ...entry,
    masonry:material('Kesk 9 · selected Kesk 5 pale masonry','#ffffff'),
    plinth:material('Kesk 9 · provisional reused roughcast','#777970'),
    concrete:material('Kesk 9 · reused concrete','#b5b6ac'),
    band:material('Kesk 9 · pale continuous concrete bands','#f4f4eb'),
    roof:material('Kesk 9 · provisional reused felt','#828780'),
    housing:material('Kesk 9 · unresolved roof housing finish','#999f98'),
    frame:material('Kesk 9 · pale replacement frames','#e0e2db',.72),
    aged:material('Kesk 9 · aged painted timber frames','#62645a',.85),
    red:material('Kesk 9 · dark red painted timber frames','#58352f',.80),
    brown:material('Kesk 9 · brown painted timber frames','#665a4d',.80),
    glass:material('Kesk 9 · provisional glazing','#45565c',.42),
    door:material('Kesk 9 · unresolved entrance finishes','#868d89'),
    sill:material('Kesk 9 · provisional sill metal','#818b8d',.45),
  };
  [materials.masonry.map,materials.masonry.bumpMap]=pale.maps; materials.masonry.bumpScale=.024;
  [materials.plinth.map,materials.plinth.bumpMap]=shared.maps['roughcast-v1']; materials.plinth.bumpScale=.035;
  materials.concrete.map=materials.band.map=shared.maps['concrete-v1'][0];
  materials.roof.map=shared.maps['felt-colour-v1'][0]; materials.roof.bumpMap=shared.maps['felt-relief-v1'][0]; materials.roof.bumpScale=.018;
  materials.sill.metalness=.55;
  for(const m of [materials.frame,materials.aged,materials.red,materials.brown,entry.trim])m.userData.joinery=true;
  const frameMaterial={pale:materials.frame,aged:materials.aged,red:materials.red,brown:materials.brown};
  const frameRegions=schedule.filter(o=>o.kind!=='door').flatMap(o=>openingHalves(o).map(p=>({...p,head:o.head,side:o.elevation==='WNW'?-1:1,style:paneFrame(o,p.low)})));
  function frameAt(poly:Vertex[]) {
    const [x,y,z]=[0,1,2].map(i=>poly.reduce((sum,v)=>sum+v.p[i],0)/3);
    const region=frameRegions.find(p=>Math.sign(z)===p.side&&x>=p.a-.001&&x<=p.b+.001&&y>=p.low-.001&&y<=p.head+.001&&!(Math.abs(x-p.a)<.001&&poly[0].n[0]>.99)&&!(Math.abs(x-p.b)<.001&&poly[0].n[0]<-.99));
    return region?.style?frameMaterial[region.style.finish]:materials.frame;
  }
  const rows=new Map<THREE.MeshStandardMaterial,number[]>();
  function emit(poly: Vertex[], mat: THREE.MeshStandardMaterial) {
    for(let i=1;i<poly.length-1;i++) {
      const triangle=[poly[0],poly[i],poly[i+1]], a=new THREE.Vector3(...triangle[0].p), b=new THREE.Vector3(...triangle[1].p), c=new THREE.Vector3(...triangle[2].p);
      if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)continue;
      let row=rows.get(mat); if(!row)rows.set(mat,row=[]);
      for(const v of triangle)row.push(...v.p,...v.n);
    }
  }
  const lintels=[-1,1].flatMap(side=>Array.from({length:design.floors},(_,floor)=>({side,x0:-design.length/2,x1:design.length/2,y0:openingRows.firstHead+floor*openingRows.pitch,y1:openingRows.firstHead+floor*openingRows.pitch+.18})));
  const basementLintels=schedule.filter(o=>o.kind==='basement').map(o=>({side:o.elevation==='WNW'?-1:1,x0:o.x-o.width/2-.10,x1:o.x+o.width/2+.10,y0:o.head,y1:o.head+.09}));
  function region(poly: Vertex[], material: THREE.MeshStandardMaterial) {
    if(poly.length<3)return;
    let parts=[poly];
    const n=poly[0].n, side=Math.sign(n[2]),exterior=-design.width/2;
    const patches:{planes:((v:Vertex)=>number)[];material:THREE.MeshStandardMaterial}[]=[];
    if(Math.abs(n[2])>.99&&poly.every(v=>Math.abs(v.p[2]-side*design.width/2)<1e-4)) {
      for(const l of [...lintels,...basementLintels].filter(l=>l.side===side))patches.push({planes:[v=>v.p[0]-l.x0,v=>l.x1-v.p[0],v=>v.p[1]-l.y0,v=>l.y1-v.p[1]],material:materials.band});
      if(side<0)for(const [a,b] of [[door.x-door.width/2-.18,door.x-door.width/2],[door.x+door.width/2,door.x+door.width/2+.18]])patches.push({planes:[v=>v.p[0]-a,v=>b-v.p[0],v=>v.p[1]-door.sill,v=>door.head-v.p[1]],material:entry.jamb});
    }
    if(Math.abs(n[0])>.99&&poly.every(v=>Math.abs(Math.abs(v.p[0]-door.x)-door.width/2)<1e-4&&v.p[2]>=exterior-1e-4&&v.p[2]<=exterior+design.wall+1e-4))patches.push({planes:[v=>v.p[1]-door.sill,v=>door.head-v.p[1]],material:entry.jamb});
    for(const patch of patches)parts=parts.flatMap(part=>{
      let inner=part;for(const plane of patch.planes)inner=clip(inner,plane);
      if(inner.length<3)return [part];
      emit(inner,patch.material);
      const outside:Vertex[][]=[];inner=part;
      for(const plane of patch.planes){const out=clip(inner,plane,false);if(out.length>=3)outside.push(out);inner=clip(inner,plane);}
      return outside;
    });
    for(const part of parts)emit(part,material);
  }
  function wall(poly: Vertex[]) {
    region(clip(poly,v=>design.foundationTop-v.p[1]),materials.plinth);
    region(clip(poly,v=>v.p[1]-design.foundationTop),materials.masonry);
  }
  for(const mesh of [...root.children] as Mesh[]) {
    const p=mesh.geometry.getAttribute('position'), n=mesh.geometry.getAttribute('normal'), role=mesh.material.name;
    if(!['wall','foundation','roof','frame','glass','door'].includes(role))throw Error('Kesk 9 plain shell has an unassigned material: '+role);
    for(let i=0;i<p.count;i+=3) {
      const poly=[0,1,2].map(j=>({p:[p.getX(i+j),p.getY(i+j),p.getZ(i+j)],n:[n.getX(i+j),n.getY(i+j),n.getZ(i+j)]}));
      if(role==='wall')wall(clip(poly,v=>design.parapetTop-coping.height-v.p[1]));
      else {
        const y=poly.reduce((sum,v)=>sum+v.p[1],0)/3,selected=poly.every(v=>Math.abs(v.p[0]-door.x)<=door.width/2+.001&&v.p[1]>=door.sill-.001&&v.p[1]<=door.head+.001&&v.p[2]<-design.width/2+.4);
        const mat=role==='foundation'?(y<=design.foundationTop&&poly.some(v=>Math.abs(v.p[0])>design.length/2-.4)?materials.plinth:materials.concrete)
          :role==='roof'?(y>design.roofDeck+.01?materials.housing:materials.roof)
          :role==='frame'?(selected?entry.trim:frameAt(poly)):role==='glass'?materials.glass:selected?entry.leaf:materials.door;
        emit(poly,mat);
      }
    }
    root.remove(mesh);mesh.geometry.dispose();
  }
  function add(geometry:THREE.BufferGeometry,mat:THREE.MeshStandardMaterial,name:string) {
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    return mesh;
  }
  const outer=[[-design.length/2-coping.projection,-design.width/2-coping.projection],[design.length/2+coping.projection,-design.width/2-coping.projection],[design.length/2+coping.projection,design.width/2+coping.projection],[-design.length/2-coping.projection,design.width/2+coping.projection]];
  const inner=[[-design.length/2+design.wall,-design.width/2+design.wall],[-design.length/2+design.wall,design.width/2-design.wall],[design.length/2-design.wall,design.width/2-design.wall],[design.length/2-design.wall,-design.width/2+design.wall]];
  const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(p[0],p[1])));shape.holes.push(new THREE.Path(inner.map(p=>new THREE.Vector2(p[0],p[1]))));
  const cap=new THREE.ExtrudeGeometry(shape,{depth:coping.height,bevelEnabled:false});cap.rotateX(Math.PI/2);cap.translate(0,design.parapetTop,0);
  const cp=cap.getAttribute('position'),cn=cap.getAttribute('normal');
  for(let i=0;i<cp.count;i+=3)emit([0,1,2].map(j=>({p:[cp.getX(i+j),cp.getY(i+j),cp.getZ(i+j)],n:[cn.getX(i+j),cn.getY(i+j),cn.getZ(i+j)]})),materials.concrete);
  cap.dispose();
  for(const [mat,row] of rows) {
    const positions:number[]=[], normals:number[]=[];
    for(let i=0;i<row.length;i+=6){positions.push(...row.slice(i,i+3));normals.push(...row.slice(i+3,i+6));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    add(g,mat,'finish-region');
  }
  const sills:{id:string;from:number;to:number;level:number;side:number}[]=[];
  for(const o of schedule.filter(o=>o.kind!=='door')) {
    const side=o.elevation==='WNW'?-1:1, a=o.x-o.width/2, b=o.x+o.width/2;
    const spans=openingHalves(o).map(p=>[p.a,p.b,p.low]);
    for(const [from,to,level] of spans) {
      const profile=new THREE.Shape([[ -.25,0],[.07,-.018],[.07,-.05],[.068,-.05],[.068,-.020],[-.25,-.002]].map(([out,y])=>new THREE.Vector2(out,y)));
      const g=new THREE.ExtrudeGeometry(profile,{depth:to-from,bevelEnabled:false});
      const p=g.getAttribute('position'), n=g.getAttribute('normal');
      // Opposite along directions keep the extrusion transform right-handed.
      for(let i=0;i<p.count;i++){const out=p.getX(i), y=p.getY(i), along=p.getZ(i), nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);p.setXYZ(i,side<0?from+along:to-along,level+y,side*(design.width/2+out));n.setXYZ(i,-side*nz,ny,side*nx);}
      add(g,materials.sill,o.id+'-sill');sills.push({id:o.id,from,to,level,side});
    }
  }
  const paneDivisions:{id:string;half:string;finish:string;inferred:boolean;fractions:readonly number[];positions:number[]}[]=[];
  for(const o of schedule.filter(o=>o.kind!=='door')) {
    const sign=o.elevation==='WNW'?-1:1,z=sign*(design.width/2-.205);
    for(const p of openingHalves(o)) {
      const style=paneFrame(o,p.low);if(!style)continue;
      const positions=style.bars.map(f=>p.a+(p.b-p.a)*f),height=o.head-p.low-.11,width=style.finish==='pale'?.055:.065;
      for(const x of positions){const g=new THREE.BoxGeometry(width,height,.06);g.translate(x,(p.low+o.head)/2,z);add(g,frameMaterial[style.finish],o.id+'-observed-mullion');}
      paneDivisions.push({id:o.id,half:o.kind==='pair'?(Math.abs(p.low-o.sill)<1e-6?'tall':'short'):o.kind,finish:style.finish,inferred:!!style.inferred,fractions:style.bars,positions});
    }
  }
  const fittings=addEntranceFittings(root,door,entry);
  for(const mesh of root.children as Mesh[]) {
    if(mesh.material===entry.plaque)continue;
    const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=new Float32Array(p.count*2), mat=mesh.material;
    const sx=mat===materials.masonry||mat===entry.jamb?2.2:mat===materials.roof?16:mat===materials.plinth?2:.8;
    const sy=mat===materials.masonry||mat===entry.jamb?.996:sx;
    for(let i=0;i<p.count;i++) {
      const horizontal=Math.abs(n.getY(i))>.5;
      uv[i*2]=(horizontal?p.getX(i):Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/sx;
      uv[i*2+1]=(horizontal?p.getZ(i):p.getY(i))/sy;
    }
    mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  batchDetailStudy(root);
  root.name='kesk9-provisional-finishes';root.userData.finishes={provisional:true,lintels,basementLintels,coping:{...coping,top:design.parapetTop,bottom:design.parapetTop-coping.height},sills,paneDivisions,entrance:{id:door.id,fittings},masonryModule:[2.2,.996],source:'Selected Kesk 5 pale procedural masonry; other canonical Kesk 1/Kesk 5 textures. Physical scale and other finishes provisional',unresolved:['Unseen windows use owner-authorized inferred pane layouts; exact replacement histories unresolved','Other entrance finishes and hardware; detailed entrance mapping inferred','Exact sill/lintel dimensions','Roof housing detail and exact coping profile dimensions','Weathering and historic state']};
  const maps=Object.values(materials).map(m=>({m,map:m.map,bumpMap:m.bumpMap}));
  let disposed=false;
  return {root,ready:shared.ready,setTextures(on){if(disposed)return;for(const {m,map,bumpMap} of maps){m.map=on?map:null;m.bumpMap=on?bumpMap:null;m.needsUpdate=true;}},dispose(){if(disposed)return;disposed=true;plain.dispose();Object.values(materials).forEach(m=>m.dispose());plaqueTexture?.dispose();pale.release();}};
}
