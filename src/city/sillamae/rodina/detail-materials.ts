import * as THREE from 'three';

export function rodinaMaterials(){
 const textures: THREE.Texture[]=[],materials: Record<string,THREE.MeshStandardMaterial>={},uniforms: {value: number}[]=[];let seed=1927;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function grain(relief=false){const n=256,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const noise=random(),i=(y*n+x)*4,v=relief?Math.round(96+noise*64):Math.round(230+noise*25);data.set([v,v,v,255],i);}const t=new THREE.DataTexture(data,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;if(!relief)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;textures.push(t);return t;}
 const colour=grain(),relief=grain(true);
 const common=`varying vec3 vRodinaP;
 float rh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float rn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(rh(i),rh(i+vec2(1.,0.)),f.x),mix(rh(i+vec2(0.,1.)),rh(i+1.),f.x),f.y);}
 float rodinaPatch(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;return exp(-dot(q,q)*2.);}
 float rodinaExposure(vec3 p,float pad){float lo=-2.1+.16*rn(vec2(p.y*6.,0.)),hi=-.18-.12*rn(vec2(p.y*7.,2.));return step(lo-pad,p.x)*step(p.x,hi+pad)*exp(-abs(p.z-17.43)*18.)*step(.16-pad,p.y)*step(p.y,1.12+.2*rn(p.xz*5.)+pad);}
 `;
 function make(name: string,color: THREE.ColorRepresentation,roughness: number,kind=0,metalness=0,bump=.004){
  const m=new THREE.MeshStandardMaterial({name:'Rodina '+name,color,roughness,metalness,map:colour,bumpMap:relief,bumpScale:bump});
  const state={detail:{value:1},kind:{value:kind}};uniforms.push(state.detail);
  m.onBeforeCompile=s=>{s.uniforms.rodinaDetail=state.detail;s.uniforms.rodinaKind=state.kind;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRodinaP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRodinaP=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float rodinaDetail; uniform float rodinaKind;\n'+common).replace('#include <color_fragment>',`#include <color_fragment>
 vec3 p=vRodinaP;float n=rn(p.xz*2.3+p.y*.19),fine=rn(vec2(p.x+p.z,p.y)*23.);
 if(rodinaKind==1.){
  float base=1.-smoothstep(.53,.58,p.y);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.205,.16),base);
  float low=exp(-max(p.y,0.)*1.5)*(.3+.7*n);
  float court=rodinaPatch(p.zy,vec2(18.6,3.3),vec2(2.,5.))*exp(-abs(p.x)*8.)+rodinaPatch(p.xy,vec2(-.7,3.7),vec2(1.2,5.))*exp(-abs(p.z-17.43)*8.);
  float garden=rodinaPatch(p.zy,vec2(43.7,2.7),vec2(1.7,4.2))*exp(-abs(p.x-17.8)*8.);
  float end=rodinaPatch(p.zy,vec2(4.1,3.5),vec2(1.7,5.))*exp(-abs(p.x+23.92)*8.);
  float damp=clamp(low*.4+court*1.55+garden*.95+end*.95,0.,.96)*rodinaDetail;
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.10,.16,.065),damp*(.72+.28*n));
  float peel=rodinaPatch(p.xy,vec2(-8.,3.4),vec2(11.,2.))*exp(-abs(p.z-17.43)*9.)*smoothstep(.53,.78,n);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.21,.17),peel*.75*rodinaDetail);
  float brick=rodinaExposure(p,0.);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.33,.27),max(0.,rodinaExposure(p,.06)-brick)*.8*rodinaDetail);
  vec2 br=vec2(p.x/.25,p.y/.082);br.x+=mod(floor(br.y),2.)*.5;vec2 f=fract(br);float mortar=step(f.x,.032)+step(f.y,.07);vec3 bc=mix(vec3(.32,.095,.055)*( .7+.4*rh(floor(br))),vec3(.16,.145,.10),clamp(mortar,0.,1.));
  diffuseColor.rgb=mix(diffuseColor.rgb,bc,brick*rodinaDetail);
 }else if(rodinaKind==2.){
  float dirt=(.08+.12*n)+.25*exp(-max(p.y,0.)*1.8);diffuseColor.rgb*=1.-dirt*rodinaDetail;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.18,.15),smoothstep(.86,.97,fine)*.12*rodinaDetail);
 }else if(rodinaKind==3.){
  diffuseColor.rgb*=1.-rodinaDetail*(.035+.055*n);vec3 rnrm=normalize(cross(dFdx(p),dFdy(p)));float coordinate=abs(rnrm.x)>abs(rnrm.z)?p.z:p.x;float sf=abs(fract(coordinate/.6+.5)-.5);float seam=1.-smoothstep(.006,.006+max(fwidth(coordinate/.6),.006),sf);diffuseColor.rgb*=1.-rodinaDetail*.1*seam;
 }else if(rodinaKind==4.){
  diffuseColor.rgb*=1.-rodinaDetail*(.14*rn(vec2(p.x+p.z,p.y*25.))+.08*n);
 }else if(rodinaKind==5.){
  float moss=(.10+.20*n)*exp(-max(p.y,0.)*.4);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.14,.075),moss*rodinaDetail);
 }else if(rodinaKind==6.){
  float rust=smoothstep(.36,.68,n)*(.35+.2*fine);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.10,.045),rust*rodinaDetail);
 }else if(rodinaKind==7.){
  float sky=smoothstep(.25,.85,rn(vec2(p.x+p.z,p.y)*.75));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.14,.16),sky*.22);
 }
 diffuseColor.rgb*=1.-rodinaDetail*(n-.5)*.055;
 `);s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 #ifdef USE_BUMPMAP
 if(rodinaKind==1.){vec3 bp=vRodinaP;vec2 bc=vec2(bp.x/.25,bp.y/.082);bc.x+=mod(floor(bc.y),2.)*.5;vec2 bf=fract(bc);float height=rodinaExposure(bp,0.)*.006*smoothstep(.015,.045,bf.x)*smoothstep(.03,.09,bf.y)*smoothstep(.01,.04,1.-bf.x)*smoothstep(.02,.07,1.-bf.y)*rodinaDetail;normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(height),dFdy(height)),faceDirection);}
 #endif
 `);};
  m.customProgramCacheKey=()=> 'rodina-surfaces-v1';m.userData.maps={map:colour,bumpMap:relief,bump};materials[name]=m;return m;
 }
 make('plaster',0xe6ca9f,.94,1,0,.006);make('trim',0xe4e4de,.9,2,0,.003);make('roof',0xa1a8aa,.9,3,.15,0);make('roofFold',0x969e9f,.9,3,.15,0);
 make('wood',0x5a4b40,.86,4,0,.003);make('door',0x662d32,.82,4,0,.0025);make('board',0xb98c52,.95,4,0,.003);
 make('glass',0x354e55,.24,7,.22,0);make('paleGlass',0x87948a,.5,7,.1,0);make('void',0x101713,1,0,0,0);
 make('iron',0x454b44,.86,6,.15,.002);make('metal',0x8a9391,.72,6,.35,.0015);make('palePipe',0xb0b5ad,.8,2,.15,.0015);
 make('concrete',0x939286,.98,5,0,.012);make('brick',0x95614c,.98,4,0,.008);make('sign',0x263b32,.8,6,.2,.001);
 make('grass',0x65744c,1,0,0,.014);
 let environment: THREE.CubeTexture | null=null;
 {const images=Array.from({length:6},(_,i)=>{const data=new Uint8Array(32*32*4),top=i===3?[119,125,104]:[185,204,213],bottom=i===2?[219,228,230]:[105,121,111];for(let y=0;y<32;y++)for(let x=0;x<32;x++){const k=(y*32+x)*4;for(let c=0;c<3;c++)data[k+c]=Math.round(top[c]+(bottom[c]-top[c])*y/31);data[k+3]=255;}return new THREE.DataTexture(data,32,32);});environment=new THREE.CubeTexture(images);environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;textures.push(environment,...images);for(const n of ['glass','paleGlass']){materials[n].envMap=environment;materials[n].envMapIntensity=.65;}}
 for(const n of ['glass','paleGlass','void','sign','roof','roofFold']){materials[n].map=null;materials[n].bumpMap=null;}
 function setTextures(on: boolean){uniforms.forEach(u=>u.value=on?1:0);for(const[key,m]of Object.entries(materials)){if(key==='glass'||key==='paleGlass')m.envMap=on?environment:null;else if(!['void','sign','roof','roofFold'].includes(key)){m.map=on?m.userData.maps.map:null;m.bumpMap=on?m.userData.maps.bumpMap:null;m.bumpScale=on?m.userData.maps.bump:0;}m.needsUpdate=true;}}
 return{materials,textures,setTextures,dispose(){Object.values(materials).forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},textureBytes:Math.ceil(256*256*4*2*4/3+6*32*32*4*4/3)};
}
