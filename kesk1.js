import {addSteppedApartment} from './stepped-apartment.js';

// Verified Kesk 1 settings. Floor indices are zero-based (L1 = 0).
// These settings are not evidence for other addresses.
export const kesk1Design=Object.freeze({
  height:28.5, floors:9, floorPitch:2.85,
  balconyEdges:[2,9,11,13,18],
  openBalconies:[[2,6],[18,1]],
  rearBrownFloors:[2,4,6,8],
  number:'1', street:'Kesk tn',
  // Individually counted from supplied June/September 2023 Street View elevations.
  vents:[{edge:1,count:5},{edge:4,count:2},{edge:8,count:8},{edge:14,count:7},{edge:16,count:1}],
  pathWidth:2.4, annexParapetHeight:1, annexStart:1.05, // User reference: shorten far end by about 1 m; entrance end stays fixed.
  // Provisional aerial-image proportion, not a surveyed height. Main roof only.
  mainParapetAboveRoof:.67,
  liftRoofDetails:true, // Rear door and small rooftop cowl from the user's aerial reference; dimensions approximate.
  // Aerial-supported relationships; dimensions provisional pending review.
  steppedFacadeEdges:[2,9,11,13,18], balconyShoulder:.26, roofShelfDepth:.45, baseProjection:.35, sideWallStep:{edge:8,width:.60,depth:.12}, entranceReturnStep:{edge:7,widthFraction:.60,projection:.12}
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










// Material replacement footprints: retain terrain outside each apron/drive polygon.
// The matching concrete/asphalt surface uses the original terrain triangulation.
export function carveGroundPatches(vertices,patches){
  if(!patches?.length)return vertices;
  const all=patches.flat(),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minZ=Math.min(...all.map(p=>p[1])),maxZ=Math.max(...all.map(p=>p[1]));
  const chunks=[];let local=[],run=0;
  for(let i=0;i<vertices.length;i+=21){
    if(vertices[i+6]!==0)continue;
    if(Math.max(vertices[i],vertices[i+7],vertices[i+14])<minX||Math.min(vertices[i],vertices[i+7],vertices[i+14])>maxX||Math.max(vertices[i+1],vertices[i+8],vertices[i+15])<minZ||Math.min(vertices[i+1],vertices[i+8],vertices[i+15])>maxZ)continue;
    if(i>run)chunks.push(vertices.subarray(run,i));run=i+21;
    local.push([0,7,14].map(j=>Array.from(vertices.subarray(i+j,i+j+7))));
  }
  if(run<vertices.length)chunks.push(vertices.subarray(run));
  for(const polygon of patches){
    const area=polygon.reduce((s,a,i)=>{const b=polygon[(i+1)%polygon.length];return s+a[0]*b[1]-a[1]*b[0];},0),sign=Math.sign(area),next=[];
    const px0=Math.min(...polygon.map(p=>p[0])),px1=Math.max(...polygon.map(p=>p[0])),pz0=Math.min(...polygon.map(p=>p[1])),pz1=Math.max(...polygon.map(p=>p[1]));
    for(const tri of local){
      if(Math.max(...tri.map(p=>p[0]))<=px0||Math.min(...tri.map(p=>p[0]))>=px1||Math.max(...tri.map(p=>p[1]))<=pz0||Math.min(...tri.map(p=>p[1]))>=pz1){next.push(tri);continue;}
      let inside=tri;
      for(let e=0;e<polygon.length&&inside.length;e++){
        const a=polygon[e],b=polygon[(e+1)%polygon.length],plane=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),yes=[],no=[];
        for(let j=0;j<inside.length;j++){const p=inside[j],q=inside[(j+1)%inside.length],dp=plane(p),dq=plane(q);(dp>=0?yes:no).push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq),v=p.map((x,k)=>x+(q[k]-x)*t);yes.push(v);no.push(v);}}
        for(let j=1;j<no.length-1;j++)next.push([no[0],no[j],no[j+1]]);inside=yes;
      }
    }local=next;
  }
  chunks.push(new Float32Array(local.flat(2)));const out=new Float32Array(chunks.reduce((s,c)=>s+c.length,0));let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;
}
