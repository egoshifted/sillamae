import * as THREE from 'three';
import Clipper from 'clipper-lib';
import type {OverrideContext} from '../../../engine/types.ts';
import {footprint,wallPolygons} from './symmetric-shell.ts';
import {openings,openingFrame,openingLoop} from './openings.ts';

type IPoint={X:number;Y:number};
interface Node {Contour():IPoint[];Childs():Node[];IsHole():boolean}
const scale=1e6;
export function consolidatedFacades(root:THREE.Object3D,context:OverrideContext){
 const walls=root.getObjectByName('walls') as THREE.Mesh<THREE.BufferGeometry>;
 const {datum,foundationBottom:bottom}=root.userData.audit,positions:number[]=[],normals:number[]=[];
 const planes=footprint.map((a,i)=>{const b=footprint[(i+1)%footprint.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,b,dx:(b[0]-a[0])/l,dz:(b[1]-a[1])/l,nx:-(b[1]-a[1])/l,nz:(b[0]-a[0])/l};});
 const unique=planes.filter((f,i)=>!planes.slice(0,i).some(g=>Math.abs(f.nx*g.nx+f.nz*g.nz-1)<1e-8&&Math.abs((f.a[0]-g.a[0])*g.nx+(f.a[1]-g.a[1])*g.nz)<1e-6));
 const src=walls.geometry.getAttribute('position'),ns=walls.geometry.getAttribute('normal');
 for(let i=0;i<src.count;i+=3){
  if(planes.some(f=>[0,1,2].every(j=>Math.abs((src.getX(i+j)+context.frame.origin[0]-f.a[0])*f.nx+(src.getZ(i+j)+context.frame.origin[1]-f.a[1])*f.nz)<.00015)))continue;
  for(let j=0;j<3;j++){positions.push(src.getX(i+j),src.getY(i+j),src.getZ(i+j));normals.push(ns.getX(i+j),ns.getY(i+j),ns.getZ(i+j));}
 }
 for(const f of unique){
  const polys=wallPolygons.filter(p=>p.every(q=>Math.abs((q[0]-f.a[0])*f.nx+(q[1]-f.a[1])*f.nz)<.075)).map(p=>p.map(q=>({X:Math.round(((q[0]-f.a[0])*f.dx+(q[1]-f.a[1])*f.dz)*scale),Y:Math.round((q[2]<15.17?bottom:q[2]+datum-14.41)*scale)}))).filter(p=>Math.abs(Clipper.Clipper.Area(p))>1);
  if(!polys.length)continue;
  for(const p of polys)if(!Clipper.Clipper.Orientation(p))p.reverse();
  const union=new Clipper.Clipper(),outer:IPoint[][]=[];union.AddPaths(polys,Clipper.PolyType.ptSubject,true);union.Execute(Clipper.ClipType.ctUnion,outer,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  const holes=openings.filter(o=>[o.a,o.b].every(p=>Math.abs((p[0]-f.a[0])*f.nx+(p[1]-f.a[1])*f.nz)<1e-6)).map(o=>{const g=openingFrame(o);return openingLoop(o).map(([x,h])=>({X:Math.round(((o.a[0]-f.a[0]+g.dx*x)*f.dx+(o.a[1]-f.a[1]+g.dz*x)*f.dz)*scale),Y:Math.round((datum+h)*scale)}));});
  const cut=new Clipper.Clipper(),tree=new Clipper.PolyTree();cut.AddPaths(outer,Clipper.PolyType.ptSubject,true);cut.AddPaths(holes,Clipper.PolyType.ptClip,true);cut.Execute(Clipper.ClipType.ctDifference,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  const points=(n:Node)=>n.Contour().map(p=>new THREE.Vector2(p.X/scale,p.Y/scale));
  function visit(n:Node){
   if(n.Contour().length&&!n.IsHole()){
    const outline=points(n),holes=n.Childs().filter(c=>c.IsHole()).map(points),all=[...outline,...holes.flat()];
    for(const tri of THREE.ShapeUtils.triangulateShape(outline,holes)){
     const [a,b,c]=tri.map(i=>all[i]);const order=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0?tri:[tri[0],tri[2],tri[1]];
     for(const i of order){const p=all[i];positions.push(f.a[0]+f.dx*p.x-context.frame.origin[0],p.y-context.frame.base,f.a[1]+f.dz*p.x-context.frame.origin[1]);normals.push(f.nx,0,f.nz);}
    }
   }n.Childs().forEach(visit);
  }visit(tree);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));walls.geometry=geometry;
 const allocated=[geometry];
 for(const o of openings.filter(o=>o.kind==='door')){
  const mesh=root.getObjectByName(o.id+'-surround') as THREE.Mesh<THREE.BufferGeometry>|undefined;if(!mesh)continue;
  const f=openingFrame(o),x=o.centre*f.length,top=o.id==='northwest-door'?4.5:4.95;
  const outline=(o.id==='northwest-door'?[[x-1.45,0],[x+1.45,0],[x+1.45,top],[x-1.45,top]]:[[x-1.45,0],[x+1.45,0],[x+1.45,top-.6],[x,top],[x-1.45,top-.6]]).map(p=>new THREE.Vector2(...p));
  const hole=openingLoop(o).map(p=>new THREE.Vector2(...p)),all=[...outline,...hole],ps:number[]=[],norms:number[]=[],old=mesh.geometry.getAttribute('position'),ns=mesh.geometry.getAttribute('normal');
  for(let i=0;i<old.count;i+=3){if([0,1,2].every(j=>Math.abs((old.getX(i+j)+context.frame.origin[0]-o.a[0])*f.nx+(old.getZ(i+j)+context.frame.origin[1]-o.a[1])*f.nz-.35)<.00015))continue;for(let j=0;j<3;j++){ps.push(old.getX(i+j),old.getY(i+j),old.getZ(i+j));norms.push(ns.getX(i+j),ns.getY(i+j),ns.getZ(i+j));}}
  for(const tri of THREE.ShapeUtils.triangulateShape(outline,[hole])){const [a,b,c]=tri.map(i=>all[i]),order=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0?tri:[tri[0],tri[2],tri[1]];for(const i of order){const p=all[i];ps.push(o.a[0]+f.dx*p.x+f.nx*.35-context.frame.origin[0],datum+p.y-context.frame.base,o.a[1]+f.dz*p.x+f.nz*.35-context.frame.origin[1]);norms.push(f.nx,0,f.nz);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norms,3));mesh.geometry=g;allocated.push(g);
 }
 return allocated;
}
