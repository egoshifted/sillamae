import {addSteppedApartment} from './stepped-apartment.js';

// Verified Kesk 1 settings. Floor indices are zero-based (L1 = 0).
// These settings are not evidence for other addresses.
export const kesk1Design=Object.freeze({
  height:28.5, floors:9, floorPitch:2.85,
  balconyEdges:[2,9,11,13,18],
  openBalconies:[[2,6],[18,1]],
  rearBrownFloors:[2,4,6,8],
  number:'1', street:'Kesk tn',
  pathWidth:2.4, annexParapetHeight:1
});

export function addKesk1(scene,building,terrain){
  return addSteppedApartment(scene,building,terrain,kesk1Design);
}

// Remove only ground triangles inside the sunken entrance footprint. Clipping,
// rather than dropping whole triangles, preserves adjacent grass and paths.
export function carveKesk1Ground(vertices,building,bounds){
  const g=building.g,a=g[19],b=g[0],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[u[1],-u[0]],depth=Math.max(...g.map(p=>(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1]))+.06+2.4;
  const local=p=>[(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1]],out=[],chunks=[];let runStart=0;
  const min=bounds?.min??4.29,max=bounds?.max??L,minD=bounds?.minD??0;
  const planes=[p=>local(p)[0]-min,p=>max-local(p)[0],p=>local(p)[1]-minD,p=>depth-local(p)[1]];
  const write=p=>{for(let j=1;j<p.length-1;j++)out.push(...p[0],...p[j],...p[j+1]);};
  for(let i=0;i<vertices.length;i+=21){if(vertices[i+6])continue;const tri=[0,7,14].map(j=>Array.from(vertices.subarray(i+j,i+j+7))),uv=tri.map(local);
    if(vertices[i+6]||Math.max(...uv.map(p=>p[0]))<min||Math.min(...uv.map(p=>p[0]))>max||Math.max(...uv.map(p=>p[1]))<minD||Math.min(...uv.map(p=>p[1]))>depth){continue;}
    if(i>runStart)chunks.push(vertices.subarray(runStart,i));runStart=i+21;
    let inside=tri;
    for(const plane of planes){if(!inside.length)break;const yes=[],no=[];for(let j=0;j<inside.length;j++){const p=inside[j],q=inside[(j+1)%inside.length],dp=plane(p),dq=plane(q);(dp>=0?yes:no).push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq),v=p.map((x,k)=>x+(q[k]-x)*t);yes.push(v);no.push(v);}}if(no.length>=3)write(no);inside=yes;}
  }
  if(runStart<vertices.length)chunks.push(vertices.subarray(runStart));chunks.push(new Float32Array(out));const result=new Float32Array(chunks.reduce((s,c)=>s+c.length,0));let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return bounds?result:carveKesk1Ground(result,building,{min:L,max:local(g[2])[0],minD:depth-2.4});
}









