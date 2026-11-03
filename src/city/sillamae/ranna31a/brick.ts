import * as THREE from 'three';
import {splitPolygon} from '../../../engine/survey/carve.ts';
import {frontDesign as d,frontSchedule} from './front-design.ts';
import {rearDesign as r} from './rear-design.ts';

export function brickSurface() {
  const loader=typeof window==='undefined'?null:new THREE.TextureLoader(),pending:Promise<unknown>[]=[];
  function map(url:URL,colour:boolean) {
    const canvas=loader?document.createElement('canvas'):null;
    if(canvas){canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#808080';ctx.fillRect(0,0,1,1);}
    const t=canvas?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.flipY=true;t.anisotropy=8;
    t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;
    if(colour)t.colorSpace=THREE.SRGBColorSpace;
    if(loader)pending.push(loader.loadAsync(url.href).then(image=>{t.image=image.image;t.needsUpdate=true;image.dispose();}));
    return t;
  }
  const colour=map(new URL('../kesk5/textures/masonry-v1-0.png',import.meta.url),true),bump=map(new URL('../kesk5/textures/masonry-v1-1.png',import.meta.url),false);
  const material=new THREE.MeshStandardMaterial({name:'plain-shell',color:'#c8a58a',roughness:1,metalness:0,map:colour,bumpMap:bump,bumpScale:.016});
  material.userData.surface='kesk1-masonry-v1';
  return {material,ready:Promise.all(pending),setTextures(enabled:boolean){material.map=enabled?colour:null;material.bumpMap=enabled?bump:null;material.needsUpdate=true;},dispose(){colour.dispose();bump.dispose();}};
}

export function applyBrick(root:THREE.Group,brick:THREE.MeshStandardMaterial) {
  const meshes:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  for(const mesh of meshes) {
    const name=mesh.name;
    if(!/^(outer-(left|right)(-end(-middle)?)?|centre-front|rear-(cheek|tower|stair-centre|entrance-pier)|upper-roof-wall|balcony-\d-continuous-cheek)/.test(name))continue;
    if(!(mesh.material instanceof THREE.MeshStandardMaterial)||mesh.material.name!=='plain-shell')continue;
    mesh.updateMatrix();const original=mesh.geometry,geo=(original.index?original.toNonIndexed():original.clone()).applyMatrix4(mesh.matrix);
    const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),plain:number[]=[],masonry:number[]=[];
    const strips=name==='centre-front'?d.centreColumns.map(x=>({x,w:frontSchedule().find(o=>o.kind==='window'&&o.group==='centre'&&o.x===x)!.width,low:x===d.entranceX?2.92-d.lift:d.firstHead,top:d.firstHead+(d.floors-1)*d.pitch})): /^rear-tower-[-\d]+$/.test(name)?[-r.towerColumn,r.towerColumn].map(x=>({x,w:1.4,low:.95-d.lift,top:r.towerHead+(d.floors-1)*d.pitch})):[];
    const emit=(polygon:number[][],out:number[])=>{for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]])out.push(...v);};
    for(let i=0;i<p.count;i+=3) {
      let pieces=[[0,1,2].map(k=>[p.getX(i+k),p.getY(i+k),p.getZ(i+k),n.getX(i+k),n.getY(i+k),n.getZ(i+k)])];
      const next:number[][][]=[];
      for(const polygon of pieces){const [above,below]=splitPolygon(polygon,v=>v[1]-(.95-d.lift));emit(below,plain);if(above.length>=3)next.push(above);}pieces=next;
      for(const strip of strips) {
        const outside:number[][][]=[];
        for(const piece of pieces) {
          let inside=piece;
          for(const plane of [(v:number[])=>v[0]-strip.x+strip.w/2,(v:number[])=>strip.x+strip.w/2-v[0],(v:number[])=>strip.top-v[1],(v:number[])=>v[1]-strip.low]) {
            const [a,b]=splitPolygon(inside,plane);if(b.length>=3)outside.push(b);inside=a;if(inside.length<3)break;
          }
          if(inside.length>=3)emit(inside,plain);
        }
        pieces=outside;
      }
      for(const polygon of pieces)emit(polygon,masonry);
    }
    function geometry(values:number[],textured:boolean) {
      const result=new THREE.BufferGeometry(),positions:number[]=[],normals:number[]=[],uv:number[]=[];
      for(let i=0;i<values.length;i+=6){const [x,y,z,nx,ny,nz]=values.slice(i,i+6);positions.push(x,y,z);normals.push(nx,ny,nz);uv.push((Math.abs(ny)>.5?x:Math.abs(nx)>.5?z:x)/2.2,(Math.abs(ny)>.5?z:y)/.996);}
      result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      const part=new THREE.Mesh(result,textured?brick:mesh.material);part.name=name+(textured?'-brick':'-neutral');part.castShadow=part.receiveShadow=true;root.add(part);
    }
    if(plain.length)geometry(plain,false);if(masonry.length)geometry(masonry,true);
    mesh.removeFromParent();original.dispose();geo.dispose();
  }
}
