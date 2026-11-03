import * as THREE from 'three';
import type {Design, Rows, Study} from '../kesk5/types.ts';

// The clipping and vertical ray tests use the unplaced shell's local coordinate system.
export function finishSlabRoof(root: Study, spec: Pick<Design,'roofDatum'>, mats: {red:THREE.MeshStandardMaterial; roofFinish:THREE.MeshStandardMaterial; roofEdgeMetal:THREE.MeshStandardMaterial}, basis: string) {
 const audit=root.userData.audit,g=audit.localFootprint;
  root.updateMatrixWorld(true);
  const bodies=root.children.filter(m=>m.name.startsWith('parapet-')||m.name.startsWith('roof-divider-'));
  const deck=root.children.find(m=>m.name==='roof')!,dg=deck.geometry.index?deck.geometry.toNonIndexed():deck.geometry.clone();dg.applyMatrix4(deck.matrixWorld);
  const dp=dg.attributes.position,deckTriangles: THREE.Vector3[][]=[],xCuts=new Set<number>(),zCuts=new Set<number>();
  for(let i=0;i<dp.count;i+=3){const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(dp,i+j));if(Math.abs(tri[0].y-spec.roofDatum)<1e-4){deckTriangles.push(tri);for(const p of tri){xCuts.add(p.x);zCuts.add(p.z);}}}
  dg.dispose();
  const overDeck=(p: THREE.Vector3)=>deckTriangles.some(t=>{const a=t[0],b=t[1],c=t[2],det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-12)return false;const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/det,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/det;return u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8;});
  const topAt=(p: THREE.Vector3)=>{const hits=new THREE.Raycaster(new THREE.Vector3(p.x,spec.roofDatum+2,p.z),new THREE.Vector3(0,-1,0),0,3).intersectObjects(bodies);return hits[0]?.point.y??spec.roofDatum;};
  const clip=(poly: THREE.Vector3[],axis: 'x'|'y'|'z',value: number,positive: boolean)=>{const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*(positive?1:-1),db=(b[axis]-value)*(positive?1:-1),ina=da>=-1e-10,inb=db>=-1e-10;if(ina)result.push(a);if(ina!==inb)result.push(a.clone().lerp(b,da/(da-db)));}return result;};
  const split=(parts: THREE.Vector3[][],axis: 'x'|'y'|'z',value: number)=>parts.flatMap(poly=>{const vs=poly.map(p=>p[axis]);return Math.min(...vs)<value-1e-8&&Math.max(...vs)>value+1e-8?[clip(poly,axis,value,false),clip(poly,axis,value,true)]:[poly];});
  const stats={sourceMeshes:bodies.length,masonryFaces:0,liningFaces:0,metalFaces:0,foldReturn:.06,membraneTileMetres:16,dimensions:basis};
  for(const mesh of bodies){
   const world=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();world.applyMatrix4(mesh.matrixWorld);const p=world.attributes.position,groups=new Map<string,Rows>();
   const match=mesh.name.match(/^parapet-(?:rear-)?(\d+)$/),edge=match?Number(match[1]):null;
   let red=true;if(edge!==null&&edge%2===0){const a=g[edge],b=g[(edge+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),along=((mesh.position.x-a[0])*(b[0]-a[0])+(mesh.position.z-a[1])*(b[1]-a[1]))/L;red=!mesh.name.startsWith('parapet-rear-')&&(along<.6||along>L-.6);}
   function emit(poly: THREE.Vector3[],normal: THREE.Vector3,kind: 'masonry'|'lining'|'metal'){if(poly.length<3)return;const rows=groups.get(kind)||{p:[],n:[],uv:[]};for(let k=1;k<poly.length-1;k++){const tri=[poly[0],poly[k],poly[k+1]],cross=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));if(cross.lengthSq()<1e-16)continue;for(const v of tri){rows.p.push(v.x,v.y,v.z);rows.n.push(normal.x,normal.y,normal.z);const horizontal=Math.abs(normal.y)>.5,u=horizontal?v.x:Math.abs(normal.x)>.5?v.z:v.x;rows.uv.push(u/(kind==='lining'?16:2.2),(horizontal?v.z:v.y)/(kind==='lining'?16:.996));}stats[kind==='masonry'?'masonryFaces':kind==='lining'?'liningFaces':'metalFaces']++;}groups.set(kind,rows);}
   for(let i=0;i<p.count;i+=3){const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)),normal=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).normalize();if(normal.lengthSq()<.5)continue;
    if(Math.abs(normal.y)>.5){emit(tri,normal,normal.y>0?'metal':red?'masonry':'metal');continue;}
    let parts=[tri];for(const x of xCuts)parts=split(parts,'x',x-normal.x*.02);for(const z of zCuts)parts=split(parts,'z',z-normal.z*.02);
    for(const part of parts){if(part.length<3)continue;const c=part.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(1/part.length),inside=overDeck(c.clone().addScaledVector(normal,.02)),kind=inside?'lining':red?'masonry':'metal',height=topAt(c.clone().addScaledVector(normal,-.01)),cut=height-.06;
     if(kind==='metal')emit(part,normal,'metal');else{emit(clip(part,'y',cut,false),normal,kind);emit(clip(part,'y',cut,true),normal,'metal');}
    }
   }
   world.dispose();
   for(const [kind,rows]of groups){if(!rows.p.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(rows.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(rows.n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(rows.uv,2));const m=new THREE.Mesh(geometry,kind==='masonry'?mats.red:kind==='lining'?mats.roofFinish:mats.roofEdgeMetal);m.name='roof-finish-'+mesh.name+'-'+kind;m.userData.roofFinishKind=kind;m.userData.roofOwner=mesh.name;m.castShadow=true;m.receiveShadow=true;root.add(m);}
  }
  for(const mesh of bodies){root.remove(mesh);mesh.geometry.dispose();}
  for(const m of root.children.filter(m=>m.name==='detail-roof-upstand-cap'))m.material=mats.roofEdgeMetal;
  audit.roofFinish=stats;
}
