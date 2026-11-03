import * as THREE from 'three';
import {groundCandidates} from '../../../engine/survey/ground-index.ts';
import {splitPolygon} from '../../../engine/survey/carve.ts';
import type {GroundTriangle} from '../../../engine/types.ts';
import {frontDesign as d, sourcePoint} from './front-design.ts';

export const apronWidth=.65;

// Each exclusion is a convex plan polygon (entrance landing, basement stair pits) that owns its own surface.
export function createFrontApron(ground:GroundTriangle[],datum:number,exclusions:number[][][],level=d.entranceLevel) {
  const edge=[[-d.halfWidth,d.sideFront],[-6.65,d.sideFront],[-6.65,d.balconyFront],[-3.8,d.balconyFront],[-3.8,d.centreFront],[3.8,d.centreFront],[3.8,d.balconyFront],[6.65,d.balconyFront],[6.65,d.sideFront],[d.halfWidth,d.sideFront]];
  const normals=edge.slice(1).map((b,i)=>{const a=edge[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);return [-(b[1]-a[1])/length,(b[0]-a[0])/length];});
  const outer=edge.map((p,i)=>{const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)],scale=apronWidth/(1+a[0]*b[0]+a[1]*b[1]);return [p[0]+(a[0]+b[0])*scale,p[1]+(a[1]+b[1])*scale];});
  const ring=[...edge,...[...outer].reverse()],positions:number[]=[];
  const samples=new Map<string,[number,number]>();
  const levels=(p:number[]):[number,number]=>{
    const key=p.map(v=>v.toFixed(6)).join(':');const cached=samples.get(key);if(cached)return cached;
    const [x,z]=sourcePoint(p[0],p[1]);let high=-Infinity,low=Infinity;
    for(const [ax,az,ah,bx,bz,bh,cx,cz,ch] of groundCandidates(ground,x,z)) {
      if(Math.max(ax,bx,cx)-Math.min(ax,bx,cx)>200)continue;
      const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-9)continue;
      const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,c=1-a-b;
      if(Math.min(a,b,c)>=-1e-6){const h=a*ah+b*bh+c*ch;high=Math.max(high,h);low=Math.min(low,h);}
    }
    if(!Number.isFinite(high))throw Error('Front apron needs survey land along its whole outline');
    const result:[number,number]=[level,low-datum-.15];samples.set(key,result);return result;
  };
  const height=(p:number[])=>levels(p)[0];
  function triangle(a:number[],b:number[],c:number[],depth=0) {
    if(depth<8&&Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>.4) {
      const ab=a.map((v,i)=>(v+b[i])/2),bc=b.map((v,i)=>(v+c[i])/2),ca=c.map((v,i)=>(v+a[i])/2);
      triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;
    }
    if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)[b,c]=[c,b];
    for(const p of [a,b,c])positions.push(p[0],height(p),p[1]);
  }
  // Subtract every exclusion before sampling the ground-following strip; pieces outside one exclusion are tested against the next.
  const inside=(polygon:number[][],p:number[])=>polygon.every((c,k)=>{const e=polygon[(k+1)%polygon.length];return (e[0]-c[0])*(p[1]-c[1])-(e[1]-c[1])*(p[0]-c[0])>=-1e-8;});
  for(const indices of THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p as [number,number])),[])) {
    let pieces=[indices.map(i=>ring[i])];
    for(const polygon of exclusions) {
      const kept:number[][][]=[];
      for(let piece of pieces) for(let i=0;i<polygon.length&&piece.length>=3;i++) {
        const a=polygon[i],b=polygon[(i+1)%polygon.length];
        const [next,outside]=splitPolygon(piece,p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        if(outside.length>=3)kept.push(outside);
        piece=next;
      }
      pieces=kept;
    }
    for(const piece of pieces)for(let j=1;j<piece.length-1;j++)triangle(piece[0],piece[j],piece[j+1]);
  }
  const surfaceCount=positions.length;
  for(let i=0;i<surfaceCount;i+=9)for(const k of [0,6,3])positions.push(positions[i+k],levels([positions[i+k],positions[i+k+2]])[1],positions[i+k+2]);
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],marks=[0,1];
    for(const polygon of exclusions)for(let j=0;j<polygon.length;j++) {
      const c=polygon[j],e=polygon[(j+1)%polygon.length],dx=b[0]-a[0],dz=b[1]-a[1],ex=e[0]-c[0],ez=e[1]-c[1],det=dx*ez-dz*ex;
      if(Math.abs(det)<1e-9)continue;
      const t=((c[0]-a[0])*ez-(c[1]-a[1])*ex)/det,u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/det;
      if(t>0&&t<1&&u>=0&&u<=1)marks.push(t);
    }
    marks.sort((x,y)=>x-y);
    for(let j=0;j<marks.length-1;j++) {
      const at=(t:number)=>a.map((v,k)=>v+(b[k]-v)*t),mid=at((marks[j]+marks[j+1])/2);
      if(exclusions.some(polygon=>inside(polygon,mid)))continue;
      const start=at(marks[j]),end=at(marks[j+1]),n=Math.max(1,Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/.3));
      for(let k=0;k<n;k++) {
        const p=start.map((v,l)=>v+(end[l]-v)*k/n),q=start.map((v,l)=>v+(end[l]-v)*(k+1)/n),hp=height(p),hq=height(q);
        const vertices=[[p[0],hp,p[1]],[q[0],hq,q[1]],[q[0],levels(q)[1],q[1]],[p[0],levels(p)[1],p[1]]];
        for(const index of [0,1,2,0,2,3])positions.push(...vertices[index]);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2]]:[]),2));geometry.computeVertexNormals();
  return {geometry,edge,outer,width:apronWidth};
}
