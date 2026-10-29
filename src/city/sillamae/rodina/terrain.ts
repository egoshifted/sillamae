import * as THREE from 'three';
import {terrainData as data} from './terrain-data.ts';

export function terrainHeight(x: number,z: number){
 const u=Math.max(0,Math.min(data.nx-1.00001,(x-data.x0)/data.step)),v=Math.max(0,Math.min(data.nz-1.00001,(z-data.z0)/data.step)),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,k=j*data.nx+i,h=data.values;
 return h[k]*(1-a)*(1-b)+h[k+1]*a*(1-b)+h[k+data.nx]*(1-a)*b+h[k+data.nx+1]*a*b;
}

export function groundRange(x0: number,x1: number,z0: number,z1: number): [number,number]{
 const h=[];for(let i=0;i<=4;i++)for(let j=0;j<=4;j++)h.push(terrainHeight(x0+(x1-x0)*i/4,z0+(z1-z0)*j/4));return[Math.min(...h),Math.max(...h)];
}

export function createTerrain(cutouts: {u: number[]; v: number[]}[]=[]){
 const xs=Array.from({length:data.nx},(_,i)=>data.x0+i*data.step),zs=Array.from({length:data.nz},(_,i)=>data.z0+i*data.step);
 for(const h of cutouts){xs.push(...h.u);zs.push(...h.v);}
 const unique=(a: number[])=>a.sort((a,b)=>a-b).filter((n,i,a)=>!i||n-a[i-1]>1e-6),x=unique(xs),z=unique(zs),positions=[],indices=[];
 for(const v of z)for(const u of x)positions.push(u,terrainHeight(u,v),v);
 for(let j=0;j<z.length-1;j++)for(let i=0;i<x.length-1;i++){
  const u=(x[i]+x[i+1])/2,v=(z[j]+z[j+1])/2;
  if(cutouts.some(h=>u>h.u[0]&&u<h.u[1]&&v>h.v[0]&&v<h.v[1]))continue;
  const k=j*x.length+i;indices.push(k,k+x.length,k+x.length+1,k,k+x.length+1,k+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xc6cdd0,roughness:1}));m.name='DTM-study-ground';m.receiveShadow=true;
 m.userData={source:'Local 1 m DTM-derived surface; no production survey mutation',cutouts,triangles:indices.length/3};return m;
}
