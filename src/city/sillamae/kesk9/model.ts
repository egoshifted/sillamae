import * as THREE from 'three';
import {createMassingStudy} from '../../../studio/assembly/massing.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {design, sourceFootprint, openingSchedule, type Opening} from './design.ts';
import {openingHalves} from './windows.ts';

export function createEnvelope(context: OverrideContext): StudyModel {
  return createMassingStudy(context, {footprint: sourceFootprint, height: 17.46, datum: 14.11});
}

export function sourcePosition(s: number, t: number): [number,number] {
  const [ux,uz] = design.axis;
  return [design.centre[0] + ux*s - uz*t, design.centre[1] + uz*s + ux*t];
}

export function landHeights(ground: number[][], x: number, z: number) {
  const hits: number[] = [];
  for (const t of ground) {
    const [ax,az,ah,bx,bz,bh,cx,cz,ch] = t;
    if (Math.max(ah,bh,ch) < design.datum - 5) continue;
    const d = (bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if (Math.abs(d)<1e-9) continue;
    const a = ((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d, b = ((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d, c = 1-a-b;
    if (Math.min(a,b,c)>=-1e-5) hits.push(a*ah+b*bh+c*ch);
  }
  return hits.sort((a,b) => a-b);
}

function outline(o: Opening): [number,number][] {
  const a = o.x-o.width/2, b = o.x+o.width/2, middle=o.split??o.x;
  if (o.kind !== 'pair') return [[a,o.sill],[b,o.sill],[b,o.head],[a,o.head]];
  return o.tall === 'left'
    ? [[a,o.sill],[middle,o.sill],[middle,o.shortSill!],[b,o.shortSill!],[b,o.head],[a,o.head]]
    : [[a,o.shortSill!],[middle,o.shortSill!],[middle,o.sill],[b,o.sill],[b,o.head],[a,o.head]];
}

export function createBuilding(context: OverrideContext, schedule: Opening[] = openingSchedule()): StudyModel {
  const root = new THREE.Group(), materials = {
    wall: new THREE.MeshStandardMaterial({color:'#c7c8c1',roughness:1}),
    foundation: new THREE.MeshStandardMaterial({color:'#989b94',roughness:1}),
    roof: new THREE.MeshStandardMaterial({color:'#969b98',roughness:1}),
    frame: new THREE.MeshStandardMaterial({color:'#d4d6d0',roughness:1}),
    glass: new THREE.MeshStandardMaterial({color:'#71838a',roughness:.75}),
    door: new THREE.MeshStandardMaterial({color:'#868d89',roughness:1}),
  };
  const contacts: {s:number;t:number;heights:number[]}[] = [];
  for (const t of [-design.width/2,design.width/2]) for (let i=0;i<=20;i++) {
    const s=design.length*(i/20-.5), [x,z]=sourcePosition(s,t);
    contacts.push({s,t,heights:landHeights(context.ground,x,z)});
  }
  const heights=contacts.flatMap(c=>c.heights), bottom=heights.length?Math.min(...heights)-design.datum-.4:-.8;
  function add(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, name: string) {
    const mesh=new THREE.Mesh(geometry,material); mesh.name=name; mesh.castShadow=mesh.receiveShadow=true; root.add(mesh); return mesh;
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.MeshStandardMaterial,name:string) {
    if (h<=0) throw Error('Invalid assembly height');
    return add(new THREE.BoxGeometry(w,h,d),material,name).position.set(x,y,z);
  }
  function withoutFaces(source:THREE.BufferGeometry,omit:(x:number,y:number,z:number,nx:number,ny:number,nz:number)=>boolean) {
    const geometry=source.index?source.toNonIndexed():source, p=geometry.getAttribute('position'), n=geometry.getAttribute('normal'), values:{position:number[];normal:number[];uv:number[]}={position:[],normal:[],uv:[]};
    for(let i=0;i<p.count;i+=3) {
      if(omit(p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)))continue;
      for(const name of ['position','normal','uv'] as const){const a=geometry.getAttribute(name);for(let j=i;j<i+3;j++)for(let k=0;k<a.itemSize;k++)values[name].push(a.array[j*a.itemSize+k]);}
    }
    const result=new THREE.BufferGeometry();for(const name of ['position','normal','uv'] as const)result.setAttribute(name,new THREE.Float32BufferAttribute(values[name],name==='uv'?2:3));
    geometry.dispose();if(geometry!==source)source.dispose();return result;
  }
  function wall(elevation:'WNW'|'ESE',low:number,high:number,material:THREE.MeshStandardMaterial) {
    const sign=elevation==='WNW'?-1:1;
    function shape(inset:number) {
      const edge=design.length/2-inset, result=new THREE.Shape([[-edge,low],[edge,low],[edge,high],[-edge,high]].map(p=>new THREE.Vector2(...p as [number,number])));
      for(const o of schedule.filter(o=>o.elevation===elevation&&o.sill>=low&&o.head<=high))result.holes.push(new THREE.Path(outline(o).reverse().map(p=>new THREE.Vector2(...p))));
      return result;
    }
    const geometry=new THREE.ExtrudeGeometry(shape(0),{depth:design.wall,bevelEnabled:false,steps:1});
    geometry.translate(0,0,elevation==='WNW'?-design.width/2:design.width/2-design.wall);
    add(withoutFaces(geometry,(x,_y,_z,nx,_ny,nz)=>Math.abs(nx)>.99&&Math.abs(x)>design.length/2-.001||nz*sign<-.99),material,elevation+'-shell');
    const inner=new THREE.ShapeGeometry(shape(design.wall));
    if(sign>0){const indices=inner.getIndex()!;for(let i=0;i<indices.count;i+=3){const b=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,b);}const normals=inner.getAttribute('normal');for(let i=0;i<normals.count;i++)normals.setZ(i,-1);}
    inner.translate(0,0,sign*(design.width/2-design.wall));add(inner,material,elevation+'-inner');
  }
  for (const elevation of ['WNW','ESE'] as const) {
    wall(elevation,bottom,design.parapetTop,materials.wall);
    const sign=elevation==='WNW'?-1:1, exterior=sign*design.width/2, glassZ=exterior-sign*.23;
    for (const o of schedule.filter(o=>o.elevation===elevation)) {
      const halves=openingHalves(o);
      for (const p of halves) {
        const height=o.head-p.low, width=p.b-p.a, x=(p.a+p.b)/2, y=(p.low+o.head)/2, f=.055;
        box(x,y,glassZ,width,height,.018,o.kind==='door'?materials.door:materials.glass,o.id+'-infill');
        for (const px of [p.a+f/2,p.b-f/2]) box(px,y,glassZ+sign*.025,f,height,.06,materials.frame,o.id+'-jamb');
        for (const py of [p.low+f/2,o.head-f/2]) box(x,py,glassZ+sign*.025,width-2*f,f,.06,materials.frame,o.id+'-head-sill');
      }
    }
  }
  for (const sign of [-1,1]) {
    for (const [a,b,m] of [[bottom,design.foundationTop,materials.foundation],[design.foundationTop,design.parapetTop,materials.wall]] as const) {
      const backing=withoutFaces(new THREE.BoxGeometry(design.wall,b-a,design.width-2*design.wall),(_x,_y,_z,nx,_ny,nz)=>Math.abs(nz)>.99||nx*sign>.99);
      add(backing,m,'end-backing').position.set(sign*(design.length/2-design.wall/2),(a+b)/2,0);
      const face=new THREE.PlaneGeometry(design.width,b-a);face.rotateY(sign*Math.PI/2);face.translate(sign*design.length/2,(a+b)/2,0);
      add(face,m,'blank-end');
    }
  }
  box(0,design.roofDeck-.09,0,design.length-2*design.wall,.18,design.width-2*design.wall,materials.roof,'roof-deck');
  for (let section=0;section<5;section++) {
    const s=design.length*((section+.5)/5-.5);
    for (const [ds,t] of [[-1.25,-2.7],[1.25,-2.7],[0,2.7]]) box(s+ds,design.roofDeck+.42,t,.85,.84,2.3,materials.roof,'provisional-roof-vent');
    const z=-design.width/2;
    box(s,2.68,z-.6,2.65,.12,1.2,materials.roof,'entrance-canopy');
    const samples=[-.95,0,.95].flatMap(ds=>[.3,1.2].flatMap(dt=>{const [x,zs]=sourcePosition(s+ds,z-dt);return landHeights(context.ground,x,zs);}));
    const ground=samples.length?Math.max(...samples)-design.datum:0, base=samples.length?Math.min(...samples)-design.datum-.15:bottom, top=.65;
    for (let step=0;step<3;step++) {
      const high=ground+(top-ground)*(step+1)/3;
      box(s,(base+high)/2,z-(1.05-step*.35),2.1,high-base,.35,materials.foundation,'entrance-step');
    }
    box(s,(base+top)/2,z-.175,2.1,top-base,.35,materials.foundation,'entrance-landing');
  }
  batchDetailStudy(root);
  root.name='kesk9-plain-shell'; root.position.set(design.centre[0]-context.frame.origin[0],design.datum-context.frame.base,design.centre[1]-context.frame.origin[1]); root.rotation.y=Math.atan2(-design.axis[1],design.axis[0]);
  root.userData.audit={...design.provenance,schedule,contacts,bottom,sourceFootprint};
  let disposed=false;
  return {root,dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});Object.values(materials).forEach(m=>m.dispose());root.removeFromParent();}};
}
