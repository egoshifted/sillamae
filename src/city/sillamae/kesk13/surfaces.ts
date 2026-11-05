import * as THREE from 'three';

export function finishMaterials(materials: THREE.MeshStandardMaterial[]) {
 const toggles: {value:number}[]=[];
 for(const m of materials) {
  const colour=m.color.getHexString(),kind=colour==='d5d0c7'?1:colour==='8e8980'?2:colour==='e3ded3'?3:colour==='424840'?4:(colour==='8e9189'||colour==='676c64')?5:colour==='a17c68'?6:0;
  if(!kind)continue;
  const enabled={value:1};toggles.push(enabled);
  m.onBeforeCompile=shader=>{
   shader.uniforms.finishEnabled=enabled;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 finishPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nfinishPosition=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 finishPosition;
uniform float finishEnabled;
float kh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float kn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(kh(i),kh(i+vec2(1.,0.)),f.x),mix(kh(i+vec2(0.,1.)),kh(i+1.),f.x),f.y);}
`).replace('#include <color_fragment>',`#include <color_fragment>
vec3 kp=finishPosition; vec2 coord=vec2(kp.x+kp.z,kp.y);
float grain=kn(coord*28.),mottle=kn(coord*2.4);
float stain=(.05+.10*mottle)*exp(-max(kp.y,0.)*.7);
float wear=0.;
${kind===1?'wear=.025*grain+stain;':kind===2?'wear=.12*mottle+.18*exp(-max(kp.y,0.)*2.);':kind===3?'wear=.04*grain+.055*mottle;':kind===4?'wear=.04*mottle;':kind===5?'wear=.10*mottle+.04*grain;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.18,.13),smoothstep(.58,.82,kn(coord*.7))*.12*finishEnabled);':'wear=.08*mottle;'}
diffuseColor.rgb*=1.-finishEnabled*wear;
${kind===2?'float flake=smoothstep(.60,.75,kn(coord*6.))*smoothstep(.45,.62,kp.y);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.31,.20,.14),flake*.35*finishEnabled);':''}
${kind===4?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.09,.045),smoothstep(.65,.85,mottle)*.22*finishEnabled);':''}
${kind===6?'vec2 brick=vec2((kp.x+kp.z)/.25,kp.y/.07);float joint=1.-smoothstep(.02,.045,min(fract(brick.x),1.-fract(brick.x)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.25,.22),joint*.45*finishEnabled);':''}
`);
  };
  m.customProgramCacheKey=()=> 'kesk13-finish-v1-'+kind;
 }
 return {setTextures(on:boolean){toggles.forEach(v=>v.value=on?1:0);}};
}
