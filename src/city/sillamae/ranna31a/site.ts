import * as THREE from 'three';
import type {GroundTriangle,Point2} from '../../../engine/types.ts';
import {groundCandidates} from '../../../engine/survey/ground-index.ts';
import {asset as bench} from '../assets/bench-slatted-01/asset.ts';
import {asset as bin} from '../assets/bin-wheeled-01/asset.ts';
import {sourcePoint} from './front-design.ts';
import {annexOutline as ring,annexDesign as annex} from './annex-design.ts';

// Owner rear photos: a concrete-slab yard between the two rear stairs, a slab strip along the east wing stair wall carrying a bench and a bin,
// and a red-and-grey striped paver path outside both. Plan sizes are inferred from the photos; surfaces follow the upper survey layer.
const yardReach=4.5,stripReach=3.5,pathWidth=1.5,lift=.04,skirt=.12;

function frame(edge:number) {
  const a=ring[edge],b=ring[(edge+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
  return {length,normal:[-uz,ux] as Point2,at:(u:number,depth=0):Point2=>[a[0]+ux*u-uz*depth,a[1]+uz*u+ux*depth]};
}

function stripes(colours:string[],joints:string,size:number) {
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const g=canvas.getContext('2d')!,band=size/colours.length;
  colours.forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*band,size,band);});
  g.strokeStyle=joints;g.lineWidth=Math.max(1,size/128);
  for(let y=0;y<=size;y+=size/8){g.beginPath();g.moveTo(0,y);g.lineTo(size,y);g.stroke();}
  for(let row=0;row<8;row++)for(let x=(row%2)*size/8;x<size;x+=size/4){g.beginPath();g.moveTo(x,row*size/8);g.lineTo(x,(row+1)*size/8);g.stroke();}
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

function lowestLayer(ground:GroundTriangle[],x:number,z:number) {
  const [sx,sz]=sourcePoint(x,z);let h=Infinity;
  for(const [ax,az,ah,bx,bz,bh,cx,cz,ch] of groundCandidates(ground,sx,sz)) {
    if(Math.max(ax,bx,cx)-Math.min(ax,bx,cx)>200)continue;
    const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-9)continue;
    const a=((bz-cz)*(sx-cx)+(cx-bx)*(sz-cz))/det,b=((cz-az)*(sx-cx)+(ax-cx)*(sz-cz))/det,c=1-a-b;
    if(Math.min(a,b,c)>=-1e-6)h=Math.min(h,a*ah+b*bh+c*ch);
  }
  if(!Number.isFinite(h))throw Error('Ranna 31a site needs survey land');
  return h;
}

// A path of constant width along a polyline, mitred at the bends. Its height is the lowest survey layer along the centreline, smoothed over about 5 m
// so the walk reads as laid paving rather than the survey's stacked layers; it is level across its width.
// It starts at the given height, where it continues another surface, and eases onto the ground over its first 5 m.
function ribbon(ground:GroundTriangle[],datum:number,line:Point2[],width:number,material:THREE.Material,name:string,scale:number,start:number) {
  const centre:Point2[]=[];
  for(let i=0;i<line.length-1;i++){const [a,b]=[line[i],line[i+1]],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let k=0;k<n;k++)centre.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  centre.push(line.at(-1)!);
  let walked=0;const distance=centre.map((p,i)=>walked+=i?Math.hypot(p[0]-centre[i-1][0],p[1]-centre[i-1][1]):0);
  const raw=centre.map(p=>lowestLayer(ground,p[0],p[1])),heights=raw.map((_,i)=>{let s=0,c=0;for(let j=Math.max(0,i-2);j<=Math.min(raw.length-1,i+2);j++){s+=raw[j];c++;}const w=Math.min(1,distance[i]/5);return w*(s/c-datum+lift)+(1-w)*start;});
  const side=centre.map((p,i)=>{
    const a=centre[Math.max(0,i-1)],b=centre[Math.min(centre.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/l,(b[0]-a[0])/l];
    return [[p[0]+n[0]*width/2,p[1]+n[1]*width/2],[p[0]-n[0]*width/2,p[1]-n[1]*width/2]] as [Point2,Point2];
  });
  const positions:number[]=[],uvs:number[]=[];let run=0;
  const vertex=(p:Point2,y:number,v:number,u:number)=>{positions.push(p[0],y,p[1]);uvs.push(u/scale,v/scale);};
  for(let i=0;i<centre.length-1;i++) {
    const [l0,r0]=side[i],[l1,r1]=side[i+1],h0=heights[i],h1=heights[i+1],step=Math.hypot(centre[i+1][0]-centre[i][0],centre[i+1][1]-centre[i][1]);
    const quad=[[l0,h0,run,0],[r0,h0,run,width],[r1,h1,run+step,width],[l1,h1,run+step,0]] as const;
    for(const k of [0,2,1,0,3,2])vertex(quad[k][0] as Point2,quad[k][1] as number,quad[k][2] as number,quad[k][3] as number);
    for(const [p,q,hp,hq] of [[l0,l1,h0,h1],[r1,r0,h1,h0]] as const)for(const [pt,y] of [[p,hp],[q,hq],[q,hq-skirt],[p,hp],[q,hq-skirt],[p,hp-skirt]] as const)vertex(pt,y,run,0);
    run+=step;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;
  const cuts=side.slice(0,-1).map(([l0,r0],i)=>[l0,r0,side[i+1][1],side[i+1][0]].map(p=>sourcePoint(p[0],p[1])));
  return {mesh,cuts};
}

// OpenStreetMap way 468252484 (the Ranna sidewalk) east of the striped path, in tower-local metres; owner photos: light grey asphalt along the tower.
// The study's survey ground reaches 15 m past the building, so the sidewalk stops at x 26 on its way to the OSM node at x 43.9.
const sidewalkEast:Point2[]=[[-1.2,-9.9],[19.2,-11.4],[26,-11.26]],sidewalkZ=-10.6;

export function createRearSite(ground:GroundTriangle[],datum:number) {
  const root=new THREE.Group();root.name='annex-rear-site';
  const f1=frame(1),f2=frame(2),f3=frame(3),east=annex.wings.find(w=>w.edge===1)!,sea=annex.wings.find(w=>w.edge===3)!;
  // The yard and the strip are one slab surface; the path is one band round it. Both boundaries are offset lines of the east wing and the centre wall, mitred where they meet.
  const meet=(edgeA:ReturnType<typeof frame>,depthA:number,edgeB:ReturnType<typeof frame>,depthB:number):Point2=>{
    const a=edgeA.at(0,depthA),b=edgeA.at(1,depthA),c=edgeB.at(0,depthB),e=edgeB.at(1,depthB),dx=b[0]-a[0],dz=b[1]-a[1],ex=e[0]-c[0],ez=e[1]-c[1],t=((c[0]-a[0])*ez-(c[1]-a[1])*ex)/(dx*ez-dz*ex);
    return [a[0]+dx*t,a[1]+dz*t];
  };
  const along2=(p:Point2,reach:number):Point2=>{const n=f2.normal,d=(p[0]-ring[2][0])*n[0]+(p[1]-ring[2][1])*n[1];return [p[0]+n[0]*(reach-d),p[1]+n[1]*(reach-d)];};
  const seaFoot=f3.at(sea.bottom,sea.depth),eastFoot=f1.at(f1.length-east.bottom,east.depth),towerEnd=f1.length-east.landing[1];
  const slabsOutline:Point2[]=[f1.at(towerEnd,east.depth),eastFoot,ring[2],ring[3],seaFoot,along2(seaFoot,yardReach),meet(f2,yardReach,f1,stripReach),f1.at(towerEnd,stripReach)];
  // The striped path stops where its centre line reaches the line of the Ranna sidewalk; the asphalt sidewalk carries on from its end edge.
  const mid=stripReach+pathWidth/2,pathEnd=f1.at(0,mid)[1]>sidewalkZ?((f1.at(0,mid)[1]-sidewalkZ)/(f1.at(0,mid)[1]-f1.at(1,mid)[1])):0;
  const pathOutline:Point2[]=[f1.at(pathEnd,stripReach),meet(f2,yardReach,f1,stripReach),along2(seaFoot,yardReach),along2(seaFoot,yardReach+pathWidth),meet(f2,yardReach+pathWidth,f1,stripReach+pathWidth),f1.at(pathEnd,stripReach+pathWidth)];

  // Real paving is laid smooth: one plane fitted to the lowest survey layer under it, instead of following the stacked, noisy layers.
  const low=(x:number,z:number)=>{
    const [sx,sz]=sourcePoint(x,z);let h=Infinity;
    for(const [ax,az,ah,bx,bz,bh,cx,cz,ch] of groundCandidates(ground,sx,sz)) {
      if(Math.max(ax,bx,cx)-Math.min(ax,bx,cx)>200)continue;
      const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-9)continue;
      const a=((bz-cz)*(sx-cx)+(cx-bx)*(sz-cz))/det,b=((cz-az)*(sx-cx)+(ax-cx)*(sz-cz))/det,c=1-a-b;
      if(Math.min(a,b,c)>=-1e-6)h=Math.min(h,a*ah+b*bh+c*ch);
    }
    if(!Number.isFinite(h))throw Error('Annex rear site needs survey land');
    return h;
  };
  const samples=[...slabsOutline,...pathOutline],m=[[0,0,0],[0,0,0],[0,0,0]],r=[0,0,0];
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)for(const t of [0,.5,1]) {
    const x=samples[i][0]+(samples[j][0]-samples[i][0])*t,z=samples[i][1]+(samples[j][1]-samples[i][1])*t,row=[1,x,z],h=low(x,z);
    for(let a=0;a<3;a++){r[a]+=row[a]*h;for(let b=0;b<3;b++)m[a][b]+=row[a]*row[b];}
  }
  const det3=(q:number[][])=>q[0][0]*(q[1][1]*q[2][2]-q[1][2]*q[2][1])-q[0][1]*(q[1][0]*q[2][2]-q[1][2]*q[2][0])+q[0][2]*(q[1][0]*q[2][1]-q[1][1]*q[2][0]);
  const plane=[0,1,2].map(k=>det3(m.map((row,a)=>row.map((v,b)=>b===k?r[a]:v)))/det3(m));
  const top=(x:number,z:number)=>plane[0]+plane[1]*x+plane[2]*z-datum+lift;
  // Slabs and pavers run square to the centre rear wall.
  // Owner photos: slabs run square to the wall beside them, paver bands cross each path on the diagonal.
  const bearing=(edge:number,turn:number)=>Math.atan2(ring[edge+1][1]-ring[edge][1],ring[edge+1][0]-ring[edge][0])+turn;
  function surface(outline:Point2[],scale:number,angle:number) {
    const along=[Math.cos(angle),Math.sin(angle)];
    const positions:number[]=[];
    function triangle(a:Point2,b:Point2,c:Point2,depth=0) {
      if(depth<8&&Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>.5) {
        const ab:Point2=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc:Point2=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca:Point2=[(c[0]+a[0])/2,(c[1]+a[1])/2];
        triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;
      }
      if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)[b,c]=[c,b];
      for(const p of [a,b,c])positions.push(p[0],top(p[0],p[1]),p[1]);
    }
    for(const t of THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(...p)),[]))triangle(outline[t[0]],outline[t[1]],outline[t[2]]);
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.4));
      for(let k=0;k<n;k++) {
        const p=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],q=[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n],hp=top(p[0],p[1]),hq=top(q[0],q[1]);
        const v=[[p[0],hp,p[1]],[q[0],hq,q[1]],[q[0],hq-skirt,q[1]],[p[0],hp-skirt,p[1]]];
        for(const index of [0,2,1,0,3,2])positions.push(...v[index]);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[(positions[i]*along[0]+positions[i+2]*along[1])/scale,(positions[i+2]*along[0]-positions[i]*along[1])/scale]:[]),2));
    geometry.computeVertexNormals();return geometry;
  }
  const slabMap=stripes(['#a7a59c','#adaba2'],'#6f6e68',256),paverMap=stripes(['#8b4c40','#5e6265'],'#3d3b38',256);
  const slabs=new THREE.MeshStandardMaterial({name:'annex-yard-concrete-slabs',color:'#ffffff',roughness:1,map:slabMap});
  const pavers=new THREE.MeshStandardMaterial({name:'annex-striped-pavers',color:'#ffffff',roughness:.95,map:paverMap});
  if(!slabMap)slabs.color.set('#a9a79f');if(!paverMap)pavers.color.set('#76574f');
  // A slab texture tile spans 2 m (eight 0.5 m courses); a paver tile spans 1 m, one red and one grey band.
  for(const [name,outline,material,scale,angle] of [['annex-rear-slabs',slabsOutline,slabs,2,bearing(2,0)],['annex-rear-path',pathOutline,pavers,1,bearing(2,Math.PI/4)]] as const) {
    const mesh=new THREE.Mesh(surface([...outline],scale,angle),material);mesh.name=name;mesh.receiveShadow=true;root.add(mesh);
  }
  // Owner east-wing photos: the bench sits against the stair wall below the landing, the bin a little nearer the tower; both face away from the wall.
  const facing=Math.atan2(f1.normal[0],f1.normal[1]);
  for(const [object,u,depth] of [[bench.build({variant:'wood',detail:'near'}),f1.length-8.75,east.depth+.45],[bin.build({variant:'grey',detail:'near'}),f1.length-10.7,east.depth+.45]] as const) {
    const [x,z]=f1.at(u,depth);object.position.set(x,top(x,z)-lift,z);object.rotation.y=facing;object.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=o.receiveShadow=true;});root.add(object);
  }
  // The sidewalk's first short leg runs on in the path's own direction so its end edges meet exactly, then it turns along the tower.
  const asphalt=new THREE.MeshStandardMaterial({name:'ranna-sidewalk-asphalt',color:'#8a8c89',roughness:.95});
  const joint=f1.at(pathEnd,mid),walk=ribbon(ground,datum,[joint,f1.at(pathEnd-.8,mid),...sidewalkEast],pathWidth,asphalt,'ranna-sidewalk',2,top(...joint));
  root.add(walk.mesh);
  let disposed=false;
  // The studio's diagnostic ground would poke through the smoothed paving; the survey itself is untouched.
  const groundCuts=[...[...THREE.ShapeUtils.triangulateShape(slabsOutline.map(p=>new THREE.Vector2(...p)),[]).map(t=>t.map(i=>slabsOutline[i])),...THREE.ShapeUtils.triangulateShape(pathOutline.map(p=>new THREE.Vector2(...p)),[]).map(t=>t.map(i=>pathOutline[i]))].map(t=>t.map(p=>sourcePoint(p[0],p[1]))),...walk.cuts];
  return {root,groundCuts,setTextures(enabled:boolean){slabs.map=enabled?slabMap:null;pavers.map=enabled?paverMap:null;slabs.color.set(enabled&&slabMap?'#ffffff':'#a9a79f');pavers.color.set(enabled&&paverMap?'#ffffff':'#76574f');slabs.needsUpdate=pavers.needsUpdate=true;},
    dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});slabs.dispose();pavers.dispose();asphalt.dispose();slabMap?.dispose();paverMap?.dispose();root.removeFromParent();}};
}
