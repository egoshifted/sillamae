import * as THREE from 'three';
import {frontDesign as d} from './front-design.ts';

export function roundedPipe(points:number[][]) {
  const vectors=points.map(p=>new THREE.Vector3(...p as [number,number,number])),curve=new THREE.CurvePath<THREE.Vector3>();
  let start=vectors[0];
  for(let i=1;i<vectors.length-1;i++) {
    const p=vectors[i],incoming=p.clone().sub(vectors[i-1]).normalize(),outgoing=vectors[i+1].clone().sub(p).normalize();
    const radius=Math.min(.13,p.distanceTo(vectors[i-1])*.25,p.distanceTo(vectors[i+1])*.25),a=p.clone().addScaledVector(incoming,-radius),b=p.clone().addScaledVector(outgoing,radius);
    curve.add(new THREE.LineCurve3(start,a));curve.add(new THREE.QuadraticBezierCurve3(a,p,b));start=b;
  }
  curve.add(new THREE.LineCurve3(start,vectors.at(-1)!));
  return new THREE.TubeGeometry(curve,360,.065,12,false);
}

export function addFrontServices(root:THREE.Group) {
  const textures:THREE.Texture[]=[],materials:THREE.MeshStandardMaterial[]=[];
  const yellow=new THREE.MeshStandardMaterial({name:'gas-pipe-yellow',color:'#eeb333',roughness:.65});materials.push(yellow);
  const add=(geometry:THREE.BufferGeometry,material:THREE.MeshStandardMaterial,name:string)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
  for(const [index,text] of ['Ranna 31a','KÜ Beregovaja 31a'].entries()) {
    const canvas=typeof document==='undefined'?null:document.createElement('canvas');
    if(canvas) {
      canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;
      ctx.fillStyle='#f2f3ee';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#333b43';ctx.lineWidth=8;ctx.strokeRect(8,8,1008,240);
      ctx.fillStyle='#172534';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${index===0?155:99}px Arial`;
      if(index===0){ctx.fillText('Ranna',322,136);ctx.fillText('31a',817,136);ctx.beginPath();ctx.moveTo(652,8);ctx.lineTo(652,248);ctx.stroke();}
      else ctx.fillText(text,512,136);
    }
    const texture=canvas?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([240,240,235,255]),1,1);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;textures.push(texture);
    const material=new THREE.MeshStandardMaterial({name:'address-plaque-'+index,map:texture,roughness:.85});materials.push(material);
    add(new THREE.BoxGeometry(1.12,.28,.025),material,'address-'+text).position.set(-12.45,3.65-index*.31,d.sideFront+.025);
  }
  const g=-d.lift, h=1.25+g, front=d.balconyFront+.22, wall=d.sideFront+.12, centre=d.centreFront+.16;
  const points=[[-d.halfWidth, h,wall],[-6.85,h,wall],[-6.85,h,front],[-3.62,h,front],[-3.62,h,centre],[-3.62,3.27+g,centre],[.35,3.27+g,centre],[.35,h,centre],[3.62,h,centre],[3.62,h,front],[6.85,h,front],[6.85,h,wall],[d.halfWidth+.16,h,wall],[d.halfWidth+.16,h,2.95]];
  add(roundedPipe(points),yellow,'front-yellow-pipe');
  for(const x of [-12,-8.2,8.2,12]) {
    add(new THREE.BoxGeometry(.07,.20,.07),yellow,'pipe-wall-bracket').position.set(x,h-.12,wall-.04);
    add(new THREE.BoxGeometry(.07,.055,.17),yellow,'pipe-wall-bracket-arm').position.set(x,h-.045,wall-.06);
  }
  for(const x of [-5.7,-4.2,4.2,5.7])add(new THREE.BoxGeometry(.07,.19,.12),yellow,'pipe-balcony-bracket').position.set(x,h-.12,front-.06);
  return {dispose(){textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}};
}
