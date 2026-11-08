import * as THREE from 'three';

export interface WearMarks {patches: number[][]; streaks: number[][]}

export function finishMaterials(materials: THREE.MeshStandardMaterial[], marks?: WearMarks) {
 const toggles: {value:number}[]=[];
 const patches=(marks?.patches??[]).map(v=>new THREE.Vector4(...v)),streaks=(marks?.streaks??[]).map(v=>new THREE.Vector4(...v));
 for(const m of materials) {
  const colour=m.color.getHexString(),kind=colour==='d5d0c7'?1:colour==='8e8980'?2:colour==='e3ded3'?3:colour==='424840'?4:(colour==='8e9189'||colour==='676c64')?5:colour==='a17c68'?6:0;
  if(!kind)continue;
  const enabled={value:1};toggles.push(enabled);
  const marked=kind===1&&patches.length>0&&streaks.length>0;
  m.onBeforeCompile=shader=>{
   shader.uniforms.finishEnabled=enabled;
   if(marked){shader.uniforms.wearPatches={value:patches};shader.uniforms.wearStreaks={value:streaks};}
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 finishPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nfinishPosition=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 finishPosition;
uniform float finishEnabled;
float kh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float kn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(kh(i),kh(i+vec2(1.,0.)),f.x),mix(kh(i+vec2(0.,1.)),kh(i+1.),f.x),f.y);}
${marked?`uniform vec4 wearPatches[${patches.length}];
uniform vec4 wearStreaks[${streaks.length}];
// Marks are pairs: centre or top (x, height, z, half width), then wall direction (dx, dz), extent and strength.
vec2 wallFrame(vec3 p,vec4 a,vec4 b){vec2 r=p.xz-a.xz;return vec2(dot(r,b.xy),b.x*r.y-b.y*r.x);}
vec3 weather(vec3 colour,vec3 p){
 float damp=0.,run=0.;
 for(int i=0;i<${patches.length};i+=2){
  vec4 a=wearPatches[i],b=wearPatches[i+1];vec2 f=wallFrame(p,a,b);
  // Reveals sit up to 0.2 m behind the face; anything further belongs to another wall.
  if(abs(f.y)>.35)continue;
  float e=length(vec2(f.x/a.w,(p.y-a.y)/b.z))+(kn(vec2(f.x,p.y)*2.6)-.5)*.55;
  float spots=smoothstep(.3,.7,kn(vec2(f.x,p.y)*7.)+.35*kn(vec2(f.x,p.y)*23.)-.15);
  damp=max(damp,(1.-smoothstep(.45,1.,e))*b.w*(.35+.65*spots));
 }
 for(int i=0;i<${streaks.length};i+=2){
  vec4 a=wearStreaks[i],b=wearStreaks[i+1];vec2 f=wallFrame(p,a,b);
  float drop=a.y-p.y;
  if(abs(f.y)>.35||drop<0.||drop>b.z||abs(f.x)>a.w)continue;
  float edge=1.-smoothstep(a.w*.55,a.w,abs(f.x)),fade=pow(1.-drop/b.z,1.6);
  float lines=smoothstep(.3,.8,kn(vec2(f.x*16.,p.y*.7)));
  run=max(run,edge*fade*(.3+.7*lines)*b.w);
 }
 colour=mix(colour,colour*vec3(.55,.57,.53),damp*finishEnabled);
 return mix(colour,colour*vec3(.74,.72,.66),run*finishEnabled);
}`:''}
`).replace('#include <color_fragment>',`#include <color_fragment>
vec3 kp=finishPosition; vec2 coord=vec2(kp.x+kp.z,kp.y);
float grain=kn(coord*28.),mottle=kn(coord*2.4);
float stain=(.05+.10*mottle)*exp(-max(kp.y,0.)*.7);
float wear=0.;
${kind===1?'wear=.025*grain+stain;':kind===2?'wear=.12*mottle+.18*exp(-max(kp.y,0.)*2.);':kind===3?'wear=.04*grain+.055*mottle;':kind===4?'wear=.04*mottle;':kind===5?'wear=.10*mottle+.04*grain;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.18,.13),smoothstep(.58,.82,kn(coord*.7))*.12*finishEnabled);':'wear=.08*mottle;'}
${kind===2&&marks?'float exposed=.8*smoothstep(.62,.8,kn(vec2(coord.x*1.4,coord.y*4.5))+.22*kn(coord*12.));diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.15,.075,.06),diffuseColor.rgb*.85,exposed),finishEnabled);':''}
diffuseColor.rgb*=1.-finishEnabled*wear;
${kind===2&&!marks?'float flake=smoothstep(.60,.75,kn(coord*6.))*smoothstep(.45,.62,kp.y);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.31,.20,.14),flake*.35*finishEnabled);':''}
${kind===4?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.09,.045),smoothstep(.65,.85,mottle)*.22*finishEnabled);':''}
${kind===6?'vec2 brick=vec2((kp.x+kp.z)/.25,kp.y/.07);float joint=1.-smoothstep(.02,.045,min(fract(brick.x),1.-fract(brick.x)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.25,.22),joint*.45*finishEnabled);':''}
${marked?'diffuseColor.rgb=weather(diffuseColor.rgb,kp);':''}
`);
  };
  m.customProgramCacheKey=()=> 'kesk13-finish-v2-'+kind+(marks?'-worn':'');
 }
 return {setTextures(on:boolean){toggles.forEach(v=>v.value=on?1:0);}};
}
