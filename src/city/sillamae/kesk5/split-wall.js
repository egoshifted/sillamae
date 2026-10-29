import * as THREE from 'three';
// Split existing wall surfaces at a local elevation without adding overlay faces.
// Interpolate every vertex attribute so the two materials own adjacent surfaces.
export function splitWallAtHeight(root,height){
 for(const mesh of [...root.children].filter(m=>m.name.startsWith('wall-')||m.name.startsWith('shared-return-'))){const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),bounds=new THREE.Box3().setFromBufferAttribute(p),cut=height-mesh.position.y;
  if(bounds.max.y<=cut+1e-8){mesh.userData.basePart=true;g.dispose();continue;}if(bounds.min.y>=cut-1e-8){mesh.userData.basePart=false;g.dispose();continue;}
  const result=[{p:[],n:[],uv:[]},{p:[],n:[],uv:[]}];
  function half(poly,lower){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a.p[1]-cut,db=b.p[1]-cut,ai=lower?da<=0:da>=0,bi=lower?db<=0:db>=0;if(ai)out.push(a);if(ai!==bi){const t=da/(da-db),v={};for(const k of ['p','n','uv'])v[k]=a[k].map((x,j)=>x+(b[k][j]-x)*t);out.push(v);}}return out;}
  function emit(poly,dst){for(let k=1;k<poly.length-1;k++){const t=[poly[0],poly[k],poly[k+1]],a=new THREE.Vector3(...t[0].p),b=new THREE.Vector3(...t[1].p),c=new THREE.Vector3(...t[2].p);if(new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)).lengthSq()<1e-16)continue;for(const v of t)for(const key of ['p','n','uv'])dst[key].push(...v[key]);}}
  for(let i=0;i<p.count;i+=3){const poly=[0,1,2].map(j=>({p:[p.getX(i+j),p.getY(i+j),p.getZ(i+j)],n:[n.getX(i+j),n.getY(i+j),n.getZ(i+j)],uv:[uv.getX(i+j),uv.getY(i+j)]}));emit(half(poly,true),result[0]);emit(half(poly,false),result[1]);}
  root.remove(mesh);mesh.geometry.dispose();g.dispose();for(let k=0;k<2;k++){const r=result[k];if(!r.p.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(r.n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(r.uv,2));const part=new THREE.Mesh(geometry,mesh.material);part.name=mesh.name;part.position.copy(mesh.position);part.rotation.copy(mesh.rotation);part.scale.copy(mesh.scale);part.castShadow=mesh.castShadow;part.receiveShadow=mesh.receiveShadow;part.userData.basePart=k===0;root.add(part);}
 }
}
