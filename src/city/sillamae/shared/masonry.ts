import * as THREE from 'three';

export function createBrickTexture(red: boolean,relief=false){
  const w=512,h=512,data=new Uint8Array(w*h*4),hash=(a: number,b: number)=>{let v=Math.imul(a+7919,b+3719);v=Math.imul(v^(v>>>13),1274126177);return (v>>>0)/4294967296;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const row=Math.floor(y*12/h),pitch=row%2?32:64,shift=(row%4>=2?pitch/2:0),col=Math.floor((x+shift)/pitch),r=hash(row,col),xx=(x+shift)%pitch,yy=y-row*h/12;
   const rough=hash(x,y),edge=1.1+(hash(Math.floor(x/3),row)-.5)*1.4,joint=yy<edge||yy>h/12-1.4-(r*.9)||xx<1.2+(hash(col,Math.floor(y/3))-.5)*1.1;
   const chip=!joint&&(yy<3||yy>h/12-3||xx<3)&&rough>.77,proud=(joint||chip)&&hash(Math.floor(x/5),Math.floor(y/3))>.77;
   const grain=(rough-.5)*16,variation=(r-.5)*20;
   const v=relief?(proud?204:joint||chip?85:157+variation+grain):(proud?177:joint||chip?125:207+variation+grain);
   const rgb=relief?[v,v,v]:red?[v*.82,v*.53,v*.42]:[v,v+1,v-5],i=(y*w+x)*4;data.set([...rgb.map(v=>Math.max(0,Math.min(255,Math.round(v)))),255],i);
  }
  const t=new THREE.DataTexture(data,w,h);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(!relief)t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;t.anisotropy=8;
  if(red)t.userData.sharedSurface={key:'masonry-v1',index:relief?1:0};return t;
 }

let pale: {maps: [THREE.DataTexture,THREE.DataTexture]; users: number} | undefined;

export function acquirePaleMasonry() {
  const entry=pale??={maps:[createBrickTexture(false),createBrickTexture(false,true)],users:0};
  entry.users++;let released=false;
  return {maps:entry.maps,release(){
    if(released)return;released=true;
    if(--entry.users===0){entry.maps.forEach(t=>t.dispose());if(pale===entry)pale=undefined;}
  }};
}
