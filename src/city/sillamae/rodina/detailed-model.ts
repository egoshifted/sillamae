import * as THREE from 'three';
import {rodinaMaterials} from './detail-materials.ts';
import {detailBuilder} from './detail-tools.ts';
import {addRodinaOrnaments} from './ornaments.ts';
import {addRodinaJoinery} from './joinery.ts';
import type {Feature, MeshGroup, ModelOptions} from './types.ts';
import type {createRodina as createPlainRodina} from './plain-model.ts';

interface DetailedRodina extends MeshGroup {
 userData: {
  audit: ReturnType<typeof createPlainRodina>['userData']['audit'] & {
   compact: boolean; features: Feature[]; batches: number; textureBytes: number;
   openingDetails: Record<string,unknown>[]; ornaments: Record<string,unknown>[];
   standingSeams: number; conditionalPlainApproval: string; uniqueBuilding: boolean;
  };
  resources: ReturnType<typeof rodinaMaterials>;
  dispose(): void;
  setTextures(enabled: boolean): void;
  updateDetail(distance: number): void;
 };
}

export function createDetailedRodina(plain: ReturnType<typeof createPlainRodina>,{compact=false}: ModelOptions={}){
 const root=new THREE.Group() as DetailedRodina;root.name='rodina-detailed';const resources=rodinaMaterials(),b=detailBuilder(resources.materials,{compact});
 const batches=new Map(plain.children.map(m=>[m.name.replace('rodina-',''),m.geometry])),offsets: Record<string,number>={shell:0,roof:0,frames:0,access:0,backings:0};
 function classify(f: Feature){const n=f.name;if(f.material==='roof')return'roof';if(f.material==='access')return'concrete';if(f.material==='backings')return /^WELL/.test(n)?'glass':'void';if(f.material==='frames'){
  if(/court-corner-pipe/.test(n))return'palePipe';if(/ladder|guard|grille|louvre/.test(n))return'iron';if(/vent|hood|bowl|pipe|terminal|cap/.test(n))return'metal';return'wood';
 }if(/well-|retaining|cheek/.test(n))return'concrete';if(/stack-wall/.test(n))return'brick';if(/pilaster|COURT-corner|bay-|frieze|eave-|rake|pediment-|sign-band|arch/.test(n))return'trim';return'plaster';}
 for(const f of plain.userData.audit.features){const source=batches.get(f.material)!,start=offsets[f.material];offsets[f.material]+=f.vertices;if(/-bay-.*-(left|right)$/.test(f.name))continue;
  const g=new THREE.BufferGeometry();for(const a of ['position','normal'])g.setAttribute(a,new THREE.BufferAttribute(source.attributes[a].array.slice(start*3,(start+f.vertices)*3),3));b.add('base/'+f.name,g,classify(f));
 }
 const openingDetails=addRodinaJoinery(b,plain,{compact}),ornaments=addRodinaOrnaments(b,{compact});
 function roofSeams(){const roof=batches.get('roof')!,p=roof.attributes.position,n=roof.attributes.normal,lines=new Map<string,{normal: THREE.Vector3; parts: THREE.Vector3[][]}>();for(let i=0;i<p.count;i+=3){const points=[0,1,2].map(j=>new THREE.Vector3(p.getX(i+j),p.getY(i+j),p.getZ(i+j))),normal=new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0])).normalize();if(normal.y<.2)continue;const axis=Math.abs(normal.x)>Math.abs(normal.z)?2:0,values=points.map(p=>p.getComponent(axis)),min=Math.min(...values),max=Math.max(...values);for(let k=Math.ceil(min/.6);k<=Math.floor(max/.6);k++){const value=k*.6,hits: THREE.Vector3[]=[];for(let j=0;j<3;j++){const a=points[j],c=points[(j+1)%3],av=a.getComponent(axis),cv=c.getComponent(axis);if(Math.abs(cv-av)<1e-8)continue;const t=(value-av)/(cv-av);if(t>=-1e-7&&t<=1+1e-7){const q=a.clone().lerp(c,t);if(!hits.some(p=>p.distanceTo(q)<1e-5))hits.push(q);}}if(hits.length===2&&hits[0].distanceTo(hits[1])>.08){const key=[axis,k,...normal.toArray().map(x=>x.toFixed(3))].join('/');let row=lines.get(key);if(!row)lines.set(key,row={normal,parts:[]});row.parts.push(hits);}}}
  let count=0;for(const row of lines.values()){const axis=Math.abs(row.normal.x)>Math.abs(row.normal.z)?0:2,parts=row.parts.sort((a,c)=>Math.min(a[0].getComponent(axis),a[1].getComponent(axis))-Math.min(c[0].getComponent(axis),c[1].getComponent(axis))),runs: THREE.Vector3[][]=[];for(const part of parts){part.sort((a,c)=>a.getComponent(axis)-c.getComponent(axis));const last=runs.at(-1);if(last&&last[1].distanceTo(part[0])<1e-4)last[1]=part[1];else runs.push(part);}
   for(const[a,c]of runs){const dir=c.clone().sub(a),length=dir.length();dir.normalize();const side=new THREE.Vector3().crossVectors(row.normal,dir).normalize(),m=new THREE.Matrix4().makeBasis(side,row.normal,dir),g=new THREE.BoxGeometry(.014,.016,length);g.applyMatrix4(m);const centre=a.clone().add(c).multiplyScalar(.5).addScaledVector(row.normal,.008);g.translate(...centre.toArray());b.add('standing-seam-'+count++,g,'roofFold');}
  }
  const edges=new Map<string,{a: THREE.Vector3; c: THREE.Vector3; normals: THREE.Vector3[]}>(),key=(p: THREE.Vector3)=>p.toArray().map(x=>x.toFixed(4)).join(',');
  for(let i=0;i<p.count;i+=3){const points=[0,1,2].map(j=>new THREE.Vector3(p.getX(i+j),p.getY(i+j),p.getZ(i+j))),normal=new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0])).normalize();if(normal.y<.2)continue;for(let j=0;j<3;j++){const a=points[j],c=points[(j+1)%3],id=[key(a),key(c)].sort().join('/');let row=edges.get(id);if(!row)edges.set(id,row={a,c,normals:[]});row.normals.push(normal);}}
  let hips=0;for(const {a,c,normals}of edges.values()){if(normals.length!==2||normals[0].dot(normals[1])>.999)continue;const normal=normals[0].clone().add(normals[1]).normalize(),dir=c.clone().sub(a),length=dir.length();dir.normalize();const side=new THREE.Vector3().crossVectors(normal,dir).normalize(),basis=new THREE.Matrix4().makeBasis(side,normal,dir),g=new THREE.BoxGeometry(.09,.018,length+.025);g.applyMatrix4(basis);g.translate(...a.clone().add(c).multiplyScalar(.5).addScaledVector(normal,.014).toArray());b.add('roof-hip-cap-'+hips++,g,'roofFold');}
  return count;
 }
 const standingSeams=compact?0:roofSeams(),audit=b.finish(root);plain.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 root.userData.audit={...plain.userData.audit,stage:'architectural-detail',compact,...audit,openingDetails,ornaments,standingSeams,textureBytes:resources.textureBytes,conditionalPlainApproval:'29 October 2026; photo-dependent geometry may be revisited',uniqueBuilding:true};
 root.userData.resources=resources;root.userData.dispose=()=>{root.traverse(m=>{if((m as THREE.Mesh).isMesh)(m as THREE.Mesh).geometry.dispose();});resources.dispose();root.clear();};root.userData.setTextures=resources.setTextures;root.userData.updateDetail=(distance: number)=>{const folds=root.children.find(m=>m.name==='rodina-detail-roofFold');if(folds)folds.visible=distance<12;};return root;
}
