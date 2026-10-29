import * as THREE from 'three';
import type {Building, GroundTriangle, Point2, Polygon, TerrainGrid, WorldFrame} from '../../../engine/types.ts';

type Point3 = [number,number,number];

// Inputs are a corrected map footprint and ground samples, never a building mesh.
// Widths, rail runs and step counts remain photo-derived/provisional.
export function createRearSurroundings(building: Building,terrain: TerrainGrid,frame: WorldFrame,groundTriangles: GroundTriangle[]){
 const [ox,oz]=frame.origin,foundationLevel=12.8;
 const root=new THREE.Group() as THREE.Group & {children: THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]};root.name='surroundings:kesk-rear-access';root.position.y=foundationLevel-frame.base;
 const g=building.g,a=g[16],b=g[17],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],sign=Math.sign(g.reduce((s,p,i)=>{const q=g[(i+1)%g.length];return s+p[0]*q[1]-q[0]*p[1];},0)),n=[u[1]*sign,-u[0]*sign];
 const point=(x: number,y: number,d: number)=>new THREE.Vector3(a[0]-ox+u[0]*x+n[0]*d,y,a[1]-oz+u[1]*x+n[1]*d);
 const local=(p: Point2)=>[(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1]];
 function ground(x: number,d: number){const p=point(x,0,d),px=p.x+ox,pz=p.z+oz;let result=-Infinity;
  for(const t of groundTriangles){const den=(t[4]-t[7])*(t[0]-t[6])+(t[6]-t[3])*(t[1]-t[7]);if(Math.abs(den)<1e-10)continue;const A=((t[4]-t[7])*(px-t[6])+(t[6]-t[3])*(pz-t[7]))/den,B=((t[7]-t[1])*(px-t[6])+(t[0]-t[6])*(pz-t[7]))/den,C=1-A-B;if(Math.min(A,B,C)>=-1e-6)result=Math.max(result,A*t[2]+B*t[5]+C*t[8]-foundationLevel);}
  if(Number.isFinite(result))return result;
  const X=Math.max(0,Math.min(terrain.width-1.001,(px-terrain.origin[0])/terrain.step)),Z=Math.max(0,Math.min(terrain.height-1.001,(pz-terrain.origin[1])/terrain.step)),i=Math.floor(X),j=Math.floor(Z),f=X-i,v=Z-j,k=j*terrain.width+i,t=terrain.values;
  return (t[k]*(1-f)*(1-v)+t[k+1]*f*(1-v)+t[k+terrain.width]*(1-f)*v+t[k+terrain.width+1]*f*v)/10-foundationLevel;
 }
 const paving=new THREE.MeshStandardMaterial({color:'#aaa89e',roughness:1,shadowSide:THREE.DoubleSide}),rail=new THREE.MeshStandardMaterial({color:'#66665c',roughness:1,shadowSide:THREE.DoubleSide}),grass=new THREE.MeshStandardMaterial({color:'#a7ad83',roughness:1,shadowSide:THREE.DoubleSide});
 for(const material of [paving,grass]){
  // Lift contact surfaces above survey layers; buried vertical skirts must stay occluded.
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n gl_Position.z += projectionMatrix[2][2] * 1. * step(.5, normal.y);');};
  material.userData.groundSurface=true;
 }
 const batches=new Map<THREE.MeshStandardMaterial,THREE.BufferGeometry[]>([[paving,[]],[rail,[]],[grass,[]]]),patches: Polygon[]=[];
 function emit(geo: THREE.BufferGeometry,mat: THREE.MeshStandardMaterial){const plain=geo.index?geo.toNonIndexed():geo;batches.get(mat)!.push(plain);if(plain!==geo)geo.dispose();}
 function face(coords: Point3[],mat: THREE.MeshStandardMaterial,up=false){const p=coords.map(c=>point(...c));if(up&&p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).y<0)p.reverse();const geo=new THREE.BufferGeometry(),positions=[];for(let i=1;i<p.length-1;i++)positions.push(...p[0].toArray(),...p[i].toArray(),...p[i+1].toArray());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();emit(geo,mat);}
 function patch(x0: number,x1: number,d0: number,d1: number,height: (x: number,d: number)=>number){
  const corners=[[x0,d0],[x1,d0],[x1,d1],[x0,d1]],top=corners.map(([x,d]): Point3=>[x,height(x,d),d]);face(top,paving,true);
  for(let i=0;i<4;i++){const j=(i+1)%4,[x,d]=corners[i],[X,D]=corners[j],bottom=Math.min(ground(x,d),ground(X,D),top[i][1],top[j][1])-1;let f: Point3[]=[top[i],[x,bottom,d],[X,bottom,D],top[j]];if(sign<0)f.reverse();face(f,paving);}
  patches.push(corners.map(([x,d])=>{const p=point(x,0,d);return [p.x+ox,p.z+oz] as Point2;}));
 }
 function beam(from: Point3,to: Point3){const p=point(...from),q=point(...to),v=q.clone().sub(p),geo=new THREE.CylinderGeometry(.025,.025,v.length(),8),m=new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()),new THREE.Vector3(1,1,1));geo.applyMatrix4(m);emit(geo,rail);}
 function railing(x: number,d0: number,d1: number){const count=Math.ceil((d1-d0)/1.5);for(let i=0;i<=count;i++){const d=d0+(d1-d0)*i/count;beam([x,0,d],[x,.9,d]);}beam([x,.9,d0],[x,.9,d1]);}
 // Meet the corrected five-tread stair at its foot. The old draft's +0.34 m
 // landing served a different three-tread study; keeping it would bury treads.
 const stairEnd=2.37,platformEnd=4.52,turnDepth=Math.max(local(g[18])[1],local(g[19])[1])+.03;
 patch(0,L,stairEnd,turnDepth,()=>0);patch(0,platformEnd,turnDepth,7.5,()=>0);
 railing(.16,2.37,7.45);
 // Keep the last tread above the cross-fall; the apron then meets each
 // pavement edge independently instead of cutting below the uphill edge.
 const walkStart=platformEnd,stepStart=19,stepEnd=21.5,end=22.25,low=Math.max(...[21,21.25,21.5].flatMap(x=>[5.5,6.5,7.5].map(d=>ground(x,d))))+.015,upper=low+.75;
 const level=(x: number)=>upper*(x-walkStart)/(stepStart-walkStart);
 patch(walkStart,stepStart,5.5,7.5,x=>level(x));
 for(let j=0;j<5;j++)patch(stepStart+j*.5,stepStart+(j+1)*.5,5.5,7.5,()=>upper-(j+1)*.15);
 patch(stepEnd,end,5.5,7.5,(x,d)=>low+(ground(end,d)+.003-low)*(x-stepEnd)/(end-stepEnd));
 // Local grass bank from the earlier study. Feather both ends into the DTM;
 // no townwide terrain uplift. Its boundary is slightly buried for contact.
 for(let x=walkStart;x<stepStart-1e-6;x+=.5)for(let d=7.5;d<13-1e-6;d+=.5){const X=Math.min(stepStart,x+.5),D=Math.min(13,d+.5),y=(xx: number,dd: number)=>{const h=ground(xx,dd),blend=Math.max(0,1-(dd-7.5)/5.5)*Math.min(1,(xx-walkStart)/.5,(stepStart-xx)/.5);return h+Math.max(0,level(xx)-.03-h)*blend+.003;};face([[x,y(x,d),d],[X,y(X,d),d],[X,y(X,D),D],[x,y(x,D),D]],grass,true);}
 patches.push([[walkStart,7.5],[stepStart,7.5],[stepStart,13],[walkStart,13]].map(([x,d])=>{const p=point(x,0,d);return [p.x+ox,p.z+oz] as Point2;}));
 for(const [material,parts]of batches){const geo=new THREE.BufferGeometry();for(const name of ['position','normal']){const values=parts.flatMap(p=>Array.from(p.attributes[name].array));geo.setAttribute(name,new THREE.Float32BufferAttribute(values,3));}geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,material);mesh.castShadow=material===rail;mesh.receiveShadow=true;root.add(mesh);parts.forEach(p=>p.dispose());}
 const target=point(10,2,6);target.y+=root.position.y;const position=target.clone().add(new THREE.Vector3(n[0]*38-u[0]*26,30,n[1]*38-u[1]*26));
 root.userData={category:'surroundings',siteId:'kesk-rear-access',groundPatches:patches,target:target.toArray(),position:position.toArray(),levels:{threshold:.85,platform:0,walkEnd:upper,pavement:low},layout:{bayWidth:L,stairEnd,turnDepth,platformEnd,walkStart,stepStart,stepEnd,end,pathWidth:2},provisional:true};
 let disposed=false;
 root.userData.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of root.children){mesh.geometry.dispose();mesh.material.dispose();}root.removeFromParent();};
 return root;
}
