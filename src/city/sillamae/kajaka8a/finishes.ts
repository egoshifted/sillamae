import * as THREE from 'three';
import type {Point2} from '../../../engine/types.ts';
import {design} from './design.ts';

type Point = [number, number];
const outlines: Point[][] = [
  [[.04,.26],[.15,.20],[.22,.28],[.23,.65],[.20,.90],[.14,.96],[.09,.89],[.06,.61]],
  [[.20,.16],[.32,.08],[.40,.09],[.43,.19],[.34,.28],[.33,.40],[.43,.44],[.41,.57],[.33,.55],[.34,.90],[.29,.98],[.25,.91],[.24,.57],[.18,.40]],
  [[.38,.24],[.56,.20],[.58,.08],[.64,.07],[.67,.18],[.67,.41],[.53,.43],[.49,.48],[.62,.56],[.70,.70],[.71,.83],[.65,.93],[.48,.96],[.40,.87],[.36,.70],[.40,.60],[.48,.64],[.51,.75],[.57,.80],[.60,.76],[.57,.69],[.47,.63],[.43,.52],[.42,.40],[.55,.36],[.54,.31],[.39,.33]],
];
const scribbles: Point[][] = [[[.75,.39],[.77,.29],[.78,.43],[.81,.30],[.81,.44]],[[.83,.31],[.86,.30],[.85,.44]],[[.88,.32],[.92,.35],[.90,.40],[.87,.40]],[[.75,.58],[.81,.50],[.80,.70],[.75,.65],[.84,.62]],[[.86,.62],[.90,.57],[.93,.61],[.94,.68],[.97,.71]]];
const distance = (p: Point, a: Point, b: Point) => { const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))); return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
export function graffitiTexture(river = false) {
  const shapes: Point[][] = river ? [
    [[.06,.20],[.27,.16],[.32,.24],[.27,.36],[.18,.35],[.15,.59],[.31,.57],[.30,.75],[.15,.80],[.06,.70],[.03,.50]],
    [[.28,.16],[.47,.23],[.54,.34],[.49,.46],[.40,.44],[.39,.53],[.48,.56],[.47,.67],[.38,.65],[.38,.85],[.29,.79],[.31,.54]],
    [[.48,.28],[.65,.27],[.72,.34],[.73,.45],[.67,.49],[.78,.56],[.83,.72],[.78,.87],[.64,.92],[.48,.80],[.45,.65],[.54,.57],[.62,.60],[.63,.69],[.68,.72],[.70,.67],[.66,.58],[.53,.50]],
  ] : outlines;
  const width=512,height=256,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const p:Point=[x/width,1-y/height]; let inside=false,edge=1;
    for(const polygon of shapes){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;edge=Math.min(edge,distance(p,a,b));}inside ||= hit;}
    if(!river)for(const line of scribbles)for(let i=1;i<line.length;i++)edge=Math.min(edge,distance(p,line[i-1],line[i])+.010);
    const alpha=inside?.80:Math.max(0,1-edge/(river?.065:.035))*.90,noise=((Math.imul(x+13,y+71)>>>0)%97)/97;
    const rgb=river ? edge<.012?[37,49,63]:inside?[204,215,206]:[193,119,66] : inside?[224,225,212]:[108,190,87],i=(y*width+x)*4;
    data.set([...rgb,Math.round(alpha*(.68+.32*noise)*255)],i);
  }
  const texture=new THREE.DataTexture(data,width,height);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

export function finishSurface(material: THREE.MeshStandardMaterial, kind: 'east'|'west'|'river'|'wall'|'roof', centre: Point2, graffiti: THREE.Texture) {
  const enabled={value:1},a=design.footprint![kind==='river'?1:kind==='west'?2:0],b=design.footprint![kind==='river'?2:kind==='west'?3:1],d=design.footprint![3],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const origin=((a[0]-centre[0])*dx+(a[1]-centre[1])*dz)/length;
  material.onBeforeCompile=shader=>{
    shader.uniforms.kEnabled=enabled;shader.uniforms.kTag={value:graffiti};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 kUV; varying vec3 kNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nkUV=uv; kNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 kUV;
varying vec3 kNormal;
uniform float kEnabled;
uniform sampler2D kTag;
float kh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float kn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(kh(i),kh(i+vec2(1.,0.)),f.x),mix(kh(i+vec2(0.,1.)),kh(i+1.),f.x),f.y);}
`).replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=kUV*vec2(2.08,1.20);float grain=kn(p*41.),mottle=kn(p*1.7);
${kind==='roof'?`
vec2 r=kUV*16.-vec2(${a[0]-centre[0]},${a[1]-centre[1]});
vec2 q=mat2(${d[1]-a[1]},${-dz},${a[0]-d[0]},${dx})*r/${dx*(d[1]-a[1])-dz*(d[0]-a[0])};
float stain=exp(-pow((q.y-.91)/.14,2.))*(.42+.30*kn(q*vec2(13.,9.)))+exp(-pow((q.x-.94)/.13,2.))*.22;
float mottling=kn(q*vec2(9.,11.));
diffuseColor.rgb*=1.-kEnabled*clamp(stain+.12*mottling,0.,.77);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.30,.27),kEnabled*.10*smoothstep(.65,.83,mottling));
float insideRoof=smoothstep(-.005,.008,min(min(q.x,1.-q.x),min(q.y,1.-q.y)));
diffuseColor.rgb=mix(vec3(.48,.50,.47),diffuseColor.rgb,insideRoof);
`:`
#ifdef USE_BUMPMAP
float joint=1.-smoothstep(.39,.51,texture2D(bumpMap,vBumpMapUv).r);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.34,.27),joint*.64*kEnabled);
#endif
float wear=.045*mottle+.08*exp(-max(p.y,0.)*1.8);
${kind==='east'||kind==='river'?`
float u=p.x-(${origin});
float runoff=exp(-pow((u-1.25)/.85,2.))*exp(-pow((p.y-2.25)/.60,2.))*(.04+.13*kn(vec2(u*18.,p.y*.7)));
wear+=runoff;
float faded=exp(-pow((u-3.7)/1.6,2.)-pow((p.y-1.8)/1.2,2.));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.49,.37,.28),faded*.17*kEnabled);
float base=1.-smoothstep(.27+.04*kn(vec2(u*8.,0.)),.31+.04*kn(vec2(u*8.,0.)),p.y);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.31,.30,.25)*( .85+.18*grain),base*kEnabled);
${kind==='river'?'float redPanel=step(1.55,u)*step(u,2.55)*step(.65,p.y)*step(p.y,1.50);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.40,.075,.08),redPanel*.85*kEnabled);':''}
vec2 tagUV=vec2(1.-(u-${kind==='river'?'3.35':'1.35'})/${kind==='river'?'4.55':'3.5'},(p.y-.48)/1.52);
if(all(greaterThanEqual(tagUV,vec2(0.)))&&all(lessThanEqual(tagUV,vec2(1.)))){vec4 tag=texture2D(kTag,tagUV);
#ifdef USE_BUMPMAP
tag.rgb*=1.-joint*.23;
#endif
diffuseColor.rgb=mix(diffuseColor.rgb,tag.rgb,tag.a*kEnabled);}
`:''}
diffuseColor.rgb*=1.-wear*kEnabled;
${kind==='east'||kind==='west'?`float endU=-p.x-(${origin});float copingHeight=${kind==='east'?'4.71-.39':'4.39+.39'}*endU/${length};
if(dot(kNormal.xz,vec2(${dz/length},${-dx/length}))<-.5 && p.y>copingHeight-.36)diffuseColor.rgb=vec3(.27,.28,.26)*(.92+.08*grain);`:''}
`}
`);
  };
  material.customProgramCacheKey=()=> 'kajaka8a-weather-v1-'+kind;
  return {setTextures(on:boolean){enabled.value=on?1:0;}};
}


