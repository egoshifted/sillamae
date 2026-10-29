import * as THREE from 'three';
// Bake transforms and merge only identical material and shadow behaviour.
// Preserve every triangle, normal and UV; this is a study optimisation, not LOD.
export function batchDetailStudy(root){
 root.updateMatrixWorld(true);const groups=new Map(),old=[...root.children];
 for(const mesh of old){if(!mesh.isMesh||Array.isArray(mesh.material))throw Error('Unsupported study child');const key=[mesh.material.uuid,mesh.castShadow,mesh.receiveShadow].join(':');if(!groups.has(key))groups.set(key,{material:mesh.material,cast:mesh.castShadow,receive:mesh.receiveShadow,parts:[]});const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);groups.get(key).parts.push(geo);}
 const combined=[];
 try{for(const group of groups.values()){const attrs={};for(const name of ['position','normal','uv']){let total=0;for(const p of group.parts){const a=p.getAttribute(name);if(!a)throw Error('Missing '+name);total+=a.array.length;}const arr=new Float32Array(total);let off=0;for(const p of group.parts){const a=p.getAttribute(name);arr.set(a.array,off);off+=a.array.length;}attrs[name]=new THREE.BufferAttribute(arr,name==='uv'?2:3);}
  const geo=new THREE.BufferGeometry();for(const [name,a]of Object.entries(attrs))geo.setAttribute(name,a);geo.computeBoundingSphere();const m=new THREE.Mesh(geo,group.material);m.name='detail-batch';m.castShadow=group.cast;m.receiveShadow=group.receive;combined.push(m);
 }}catch(error){combined.forEach(m=>m.geometry.dispose());throw error;}finally{for(const group of groups.values())group.parts.forEach(p=>p.dispose());}
 for(const m of old){root.remove(m);m.geometry.dispose();}root.add(...combined);root.userData.batchStats={sourceMeshes:old.length,batches:combined.length};return root;
}
