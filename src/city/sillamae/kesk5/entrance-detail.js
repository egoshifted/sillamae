import * as THREE from 'three';
import {createOffsetSlabStudy} from './offset-slab.js';
import {splitWallAtHeight} from './split-wall.js';
import {applyWindowLintels} from './lintel-surfaces.js';

// Materials and frames are an initial September 2023 entrance-side pass, not
// a claim that individual windows or terrain are fully surveyed.
export function createEntranceDetailStudy(spec, balconySchedule, sharedMasonry, sharedRoof){
 // Anton 28 October: the door assembly fills the gap between the two red
 // stair jambs. Preserve the approved plain source, supersede only its
 // narrower door allocation in the detailed model.
 spec={...spec,doorWidth:spec.stairWidth};
 const root=createOffsetSlabStudy(spec), audit=root.userData.audit;
 audit.detailDoorWidth={width:spec.doorWidth,basis:'Inner red-jamb faces; Anton 28 October 2026',inferred:true};
 // Illustrative brick bond with a provisional metre-scale module.
 function brickTexture(red,relief=false){
  const w=512,h=512,data=new Uint8Array(w*h*4),hash=(a,b)=>{let v=Math.imul(a+7919,b+3719);v=Math.imul(v^(v>>>13),1274126177);return (v>>>0)/4294967296;};
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
 function panelTexture(){const w=256,h=128,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const rib=y<112&&(x%16<2),c=rib?142:164,i=(y*w+x)*4;data.set([c,c+2,c+1,255],i);}const t=new THREE.DataTexture(data,w,h);t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
 function roofTexture(){const w=256,h=256,data=new Uint8Array(w*h*4);let seed=1459;for(let y=0;y<h;y++)for(let x=0;x<w;x++){seed=(seed*1664525+1013904223)>>>0;const grain=((seed>>>24)/255-.5)*12,c=Math.round(131+grain),i=(y*w+x)*4;data.set([c,c+1,c,255],i);}const t=new THREE.DataTexture(data,w,h);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
 function roughcast(relief=false){const w=256,h=256,data=new Uint8Array(w*h*4);let seed=733;for(let y=0;y<h;y++)for(let x=0;x<w;x++){seed=(seed*1664525+1013904223)>>>0;const grain=((seed>>>24)/255-.5)*24,wave=5*Math.sin(y*.09+Math.sin(x*.04)),v=Math.max(0,Math.min(255,Math.round((relief?143:182)+grain+wave))),i=(y*w+x)*4;data.set([v,v,v-2,255],i);}const t=new THREE.DataTexture(data,w,h);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(!relief)t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
 function canopyTexture(){const w=256,h=64,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=x%16<3?60:76,i=(y*w+x)*4;data.set([v,v+4,v+3,255],i);}const t=new THREE.DataTexture(data,w,h);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
 const textures=[brickTexture(false),brickTexture(true),panelTexture(),roofTexture(),brickTexture(false,true),brickTexture(true,true),roughcast(),roughcast(true),canopyTexture()];
 if(sharedMasonry){textures[1].dispose();textures[5].dispose();textures[1]=sharedMasonry[0];textures[5]=sharedMasonry[1];for(const [i,index] of [[1,0],[5,1]])textures[i].userData.sharedSurface={key:'masonry-v1',index};}
 textures[3].userData.sharedSurface={key:'felt-colour-v1',index:0};
 const neutral=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);neutral.wrapS=neutral.wrapT=THREE.RepeatWrapping;neutral.needsUpdate=true;neutral.userData.sharedSurface={key:'felt-relief-v1',index:0};textures.push(neutral);
 if(sharedRoof){textures[3].dispose();textures[9].dispose();textures[3]=sharedRoof[0];textures[9]=sharedRoof[1];textures[3].userData.sharedSurface={key:'felt-colour-v1',index:0};textures[9].userData.sharedSurface={key:'felt-relief-v1',index:0};}
 const mats={brick:new THREE.MeshStandardMaterial({color:0xffffff,map:textures[0],bumpMap:textures[4],bumpScale:.024,roughness:1}),red:new THREE.MeshStandardMaterial({color:0xc8a58a,map:textures[1],bumpMap:textures[5],bumpScale:.016,roughness:1}),base:new THREE.MeshStandardMaterial({color:0xaaa9a3,roughness:1}),foundation:new THREE.MeshStandardMaterial({color:0xffffff,map:textures[6],bumpMap:textures[7],bumpScale:.025,roughness:1}),glass:new THREE.MeshStandardMaterial({color:0x6a8189,roughness:.45,metalness:.08}),frame:new THREE.MeshStandardMaterial({color:0xd6d8d3,roughness:.7}),reveal:new THREE.MeshStandardMaterial({color:0xc7c8c0,roughness:1}),sill:new THREE.MeshStandardMaterial({color:0x969d9a,roughness:.8,metalness:.1}),lintel:new THREE.MeshStandardMaterial({color:0xb6b6ae,roughness:1}),railPink:new THREE.MeshStandardMaterial({color:0x9e6c69,roughness:.85}),railGrey:new THREE.MeshStandardMaterial({color:0xa5aaa6,roughness:.8}),darkFrame:new THREE.MeshStandardMaterial({color:0x665a4d,roughness:.8}),redCover:new THREE.MeshStandardMaterial({color:0x9e4940,roughness:.9}),lightCover:new THREE.MeshStandardMaterial({color:0x9da29f,roughness:.9}),openRail:new THREE.MeshStandardMaterial({color:0x6f8178,roughness:.8,metalness:.15}),door:new THREE.MeshStandardMaterial({color:0x493d37,roughness:.9}),doorTrim:new THREE.MeshStandardMaterial({color:0x252b2a,roughness:.8}),hardware:new THREE.MeshStandardMaterial({color:0xb2b1a6,roughness:.45,metalness:.5}),plaque:new THREE.MeshStandardMaterial({color:0x292d2a,roughness:.9}),canopy:new THREE.MeshStandardMaterial({color:0x343b3b,roughness:.8}),entryCanopy:new THREE.MeshStandardMaterial({color:0xffffff,map:textures[8],roughness:.85}),panel:new THREE.MeshStandardMaterial({color:0xffffff,map:textures[2],roughness:1}),roofFinish:new THREE.MeshStandardMaterial({color:0x7f827e,map:textures[3],bumpMap:textures[9],bumpScale:.028,roughness:1}),ventBody:new THREE.MeshStandardMaterial({color:0x8e9692,roughness:1}),ventCap:new THREE.MeshStandardMaterial({color:0xaab1ac,roughness:.85,metalness:.12}),rearWall:new THREE.MeshStandardMaterial({color:0xc9b28a,roughness:1}),enclosure:new THREE.MeshStandardMaterial({color:0xa3b8bc,roughness:.3,transparent:true,opacity:.38,depthWrite:false})};
 mats.roofEdgeMetal=new THREE.MeshStandardMaterial({color:0xa6aeac,roughness:.94,metalness:.08});mats.roofEdgeMetal.userData.sheetMetal=true;
 // Independently observed September 2023 entrance finishes; S4 remains
 // unobserved. These are appearance estimates, not sampled paint colours.
 mats.doorS1=new THREE.MeshStandardMaterial({color:0x302a2b,roughness:.9});
 mats.doorS2=new THREE.MeshStandardMaterial({color:0x51342c,roughness:.9});
 mats.doorS3=new THREE.MeshStandardMaterial({color:0x514037,roughness:.9});
 mats.kickplate=new THREE.MeshStandardMaterial({color:0x9a9d94,roughness:.82,metalness:.18});
 mats.keypad=new THREE.MeshStandardMaterial({color:0x323a38,roughness:.75});
 mats.lamp=new THREE.MeshStandardMaterial({color:0xc4c7b9,roughness:.85});
 splitWallAtHeight(root,.65); // provisional grey foundation/plinth height
 for(const m of root.children){
  if(m.name.startsWith('wall-')){const edge=Number(m.name.slice(5)),isRed=(edge%2===1)||m.material.color.getHex()===0xbdb7ac;m.material=m.userData.basePart?mats.foundation:isRed?mats.red:mats.brick;}
  else if(m.name.startsWith('shared-return-'))m.material=m.userData.basePart?mats.foundation:mats.red;
  else if(m.name.includes('foundation'))m.material=mats.foundation;
  else if(m.name.startsWith('lightwell'))m.material=mats.base;
  else if(m.name==='canopy')m.material=mats.entryCanopy;
  else if(m.name==='roof')m.material=mats.roofFinish;
  else if(m.name==='roof-vent')m.material=mats.ventBody;
  else if(m.name==='loggia-parapet')m.material=mats.panel;
  else if(m.name==='rear-window-wall')m.material=mats.rearWall;
  else if(m.name.startsWith('backing-')&&m.name.endsWith('-entrance'))m.material=mats.door;
  else if(m.name.startsWith('backing-')&&(m.name.endsWith('-window')||m.name.endsWith('-stair')))m.material=mats.glass;
 }
 const g=audit.localFootprint,area=g.reduce((a,p,i)=>{const q=g[(i+1)%g.length];return a+p[0]*q[1]-q[0]*p[1];},0);
 // The aerial shows twelve elongated upstands with pale tops. The shallow
 // sheet cap and 20 mm overhang are inferred, not surveyed.
 for(const m of [...root.children].filter(m=>m.name==='roof-vent')){const {width,height,depth}=m.geometry.parameters,g=new THREE.BoxGeometry(width+.04,.04,depth+.04),cap=new THREE.Mesh(g,mats.ventCap);cap.position.copy(m.position);cap.position.y+=height/2+.02;cap.rotation.copy(m.rotation);cap.name='detail-roof-upstand-cap';cap.castShadow=true;cap.receiveShadow=true;root.add(cap);}
 for(const m of root.children.filter(m=>m.name==='canopy')){const p=m.geometry.attributes.position,uv=m.geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getZ(i));uv.needsUpdate=true;}
 root.updateMatrixWorld(true);for(const m of root.children.filter(m=>m.material===mats.foundation)){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal,uv=m.geometry.attributes.uv,v=new THREE.Vector3(),normal=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);normal.fromBufferAttribute(n,i).transformDirection(m.matrixWorld);uv.setXY(i,(Math.abs(normal.y)>.5?v.x:Math.abs(normal.x)>.5?v.z:v.x)/2,(Math.abs(normal.y)>.5?v.z:v.y)/2);}uv.needsUpdate=true;}
 for(const m of root.children.filter(m=>m.name==='roof')){const pos=m.geometry.attributes.position,uv=m.geometry.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/16,pos.getZ(i)/16);uv.needsUpdate=true;}
 for(const m of root.children.filter(m=>m.name==='loggia-parapet')){const pos=m.geometry.attributes.position,uv=m.geometry.attributes.uv,w=m.geometry.parameters.width,h=m.geometry.parameters.height;for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+w/2), (pos.getY(i)+h/2)/h);uv.needsUpdate=true;}
 root.updateMatrixWorld(true);
 for(const m of root.children.filter(m=>(m.name.startsWith('wall-')||m.name.startsWith('shared-return-'))&&(m.material===mats.brick||m.material===mats.red))){const edge=Number(m.name.split('-').at(-1)),a=g[edge],b=g[(edge+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],pos=m.geometry.attributes.position,uv=m.geometry.attributes.uv,norm=m.geometry.attributes.normal,v=new THREE.Vector3(),normal=new THREE.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);normal.fromBufferAttribute(norm,i).transformDirection(m.matrixWorld);const along=(v.x-a[0])*u[0]+(v.z-a[1])*u[1],out=(v.x-a[0])*u[1]-(v.z-a[1])*u[0],horizontal=Math.abs(normal.x*u[0]+normal.z*u[1])>.5?out:along;uv.setXY(i,horizontal/2.2,v.y/.996);}uv.needsUpdate=true;}
 applyWindowLintels(root,spec,mats.lintel);
 function solid(edge,x,y,w,h,offset,depth,mat,name){const a=g[edge],b=g[(edge+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=area<0?[-u[1],u[0]]:[u[1],-u[0]];const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),mats[mat]);mesh.position.set(a[0]+u[0]*(x+w/2)+n[0]*offset,y+h/2,a[1]+u[1]*(x+w/2)+n[1]*offset);mesh.rotation.y=-Math.atan2(u[1],u[0]);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(const o of audit.openings.filter(o=>o.kind==='window'||o.kind==='stair'||o.kind==='entrance')){
  const fw=o.kind==='stair'?.065:.055, z=-.16, d=.04;
  if(o.kind!=='entrance'){
   const r=.025,ix=o.x+r,iy=o.y+r,iw=o.w-2*r,ih=o.h-2*r;
   for(const x of [o.x,o.x+o.w-r])solid(o.edge,x,o.y,r,o.h,-.11,.22,'reveal','detail-'+o.kind+'-reveal');
   for(const y of [o.y,o.y+o.h-r])solid(o.edge,ix,y,iw,r,-.11,.22,'reveal','detail-'+o.kind+'-reveal');
   for(const x of [ix,ix+iw-fw])solid(o.edge,x,iy,fw,ih,z,d,'frame','detail-'+o.kind+'-frame');
   for(const y of [iy,iy+ih-fw])solid(o.edge,ix+fw,y,iw-2*fw,fw,z,d,'frame','detail-'+o.kind+'-frame');
   if(o.kind==='window'){// Dated entrance images show broad centre panes in many wider three-light windows.
   // These proportions are inferred; per-apartment replacements remain uncertain.
   const positions=(o.column===1||o.column===4)?[.28,.72]:[.5];for(const fraction of positions)solid(o.edge,ix+iw*fraction-fw/2,iy,fw,ih,z,d,'frame','detail-window-mullion');solid(o.edge,o.x-.04,o.y-.065,o.w+.08,.065,.025,.05,'sill','detail-window-sill');}
   else {for(let y=iy+1.2;y<iy+ih-.2;y+=1.2)solid(o.edge,ix+fw,y,iw-2*fw,fw,z,d,'frame','detail-stair-transom');}
  }else {
   const section=spec.facades.find(f=>f.edge===o.edge).section,observed=section<=3;
   const backing=root.children.find(m=>m.name==='backing-'+o.edge+'-entrance');
   if(observed&&backing)backing.material=mats['doorS'+section];
   solid(o.edge,o.x+o.w/2-(observed?.07*o.w:.018),o.y,observed?.14*o.w:.036,o.h,observed?-.21:-.17,observed?.02:.04,observed?'doorS'+section:'doorTrim','detail-door-seam');
   for(const x of [o.x,o.x+o.w-.055])solid(o.edge,x,o.y,.055,o.h,observed?-.11:-.15,observed?.22:.06,'doorTrim','detail-door-frame');
   solid(o.edge,o.x+.055,o.y+o.h-.055,o.w-.11,.055,observed?-.11:-.15,observed?.22:.06,'doorTrim','detail-door-frame');
   // S1 has silver access hardware left of the centre; S2/S3 dark keypads
   // and a small pull to the right. S4 retains its unverified placeholder.
   solid(o.edge,o.x+o.w*(section===1?.405:.61),o.y+1.0,.03,.12,observed?-.2025:-.115,.035,'hardware','detail-door-handle');
   if(observed){
    solid(o.edge,o.x+o.w*.465-.035,1.20,.07,.18,-.19,.02,section===1?'hardware':'keypad','detail-door-keypad');
    for(let row=0;row<4;row++)for(let column=0;column<3;column++)solid(o.edge,o.x+o.w*.465-.022+column*.016,1.216+row*.025,.009,.012,-.177,.006,section===1?'keypad':'hardware','detail-keypad-button');
    const plates=section===3?[[.57,.40]]:[[.025,.375],[.57,.40]];
    for(const [from,width]of plates)solid(o.edge,o.x+o.w*from,.16,o.w*width,.18,-.216,.008,'kickplate','detail-door-kickplate');
    solid(o.edge,o.x+o.w/2-.065,spec.entryHeight-.012,.13,.012,.15,.13,'doorTrim','detail-entry-lamp-base');
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.06,12,6,0,Math.PI*2,Math.PI/2,Math.PI/2),mats.lamp),base=root.children.at(-1);
    lamp.position.copy(base.position);lamp.position.y=spec.entryHeight-.012;lamp.name='detail-entry-lamp';lamp.castShadow=true;lamp.receiveShadow=true;root.add(lamp);
   }
   if(section===2){
    // Observed dark door-mounted box with pale inset; purpose/text unknown.
    solid(o.edge,o.x+o.w*.20,1.22,.20,.28,-.19,.06,'keypad','detail-s2-door-box');
    solid(o.edge,o.x+o.w*.20+.02,1.25,.16,.10,-.156,.008,'lamp','detail-s2-box-inset');
   }
  }
 }
 // Dark plaque observed left of the S2 stair surround in the dated view;
 // text is unreadable and deliberately omitted. Position/size are inferred.
 {const facade=spec.facades.find(f=>f.type==='entrance'&&f.section===2),stair=audit.openings.find(o=>o.edge===facade.edge&&o.kind==='stair');solid(facade.edge,stair.x-.50,1.7,.30,.18,.006,.012,'plaque','detail-s2-plaque');}
 // September 2023 views show a shallow approach step and side rails on S1/S2/S3.
 // Flat-ground heights and rail offsets are provisional until terrain integration.
 for(const f of spec.facades.filter(f=>f.type==='entrance')){const a=g[f.edge],b=g[(f.edge+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),w=spec.landingWidth,edge=f.edge;
  solid(edge,L/2-w/2,-.015,w,.095,spec.canopyDepth+.14,.36,'base','detail-entry-step');
  // Direct September 2023 S1/S2/S3 views show a bent connection from the
  // canopy's right gutter to a wall-side drop. S4 is obscured, not mirrored.
  // Route, diameter and offsets are inferred; see entrance-drainage-2026-10-28.json.
  if(f.section<=3){
   solid(edge,L/2-spec.canopyWidth/2,spec.entryHeight-.05,spec.canopyWidth,.05,spec.canopyDepth-.065,.05,'canopy','detail-entry-gutter');
   solid(edge,L/2+spec.canopyWidth/2-.05,spec.entryHeight-.05,.05,.05,(spec.canopyDepth-.09)/2,spec.canopyDepth-.09,'canopy','detail-entry-gutter-return');
   const u=new THREE.Vector3((b[0]-a[0])/L,0,(b[1]-a[1])/L),n=area<0?new THREE.Vector3(-u.z,0,u.x):new THREE.Vector3(u.z,0,-u.x),x=L/2+spec.canopyWidth/2-.025;
   const route=[[x,spec.entryHeight-.05,spec.canopyDepth-.09],[x,spec.entryHeight-.23,spec.canopyDepth-.09],[x+.18,spec.entryHeight-.48,.065],[x+.18,.07,.065]].map(([along,y,out])=>new THREE.Vector3(a[0],y,a[1]).addScaledVector(u,along).addScaledVector(n,out));
   const path=new THREE.CurvePath();for(let i=1;i<route.length;i++)path.add(new THREE.LineCurve3(route[i-1],route[i]));
   const pipe=new THREE.Mesh(new THREE.TubeGeometry(path,48,.025,6,false),mats.canopy);pipe.name='detail-entry-downpipe';pipe.castShadow=true;pipe.receiveShadow=true;pipe.userData.entranceSection=f.section;root.add(pipe);
  }
  if(f.section===1||f.section===2||f.section===3){const material=f.section===3?'railGrey':'railPink',x=L/2+spec.stairWidth/2+.10;
   // Rail mounts to the brick jamb, rather than the far edge of the wider
   // provisional landing. Preserve that landing, door and drain geometry.
   const u=new THREE.Vector3((b[0]-a[0])/L,0,(b[1]-a[1])/L),n=area<0?new THREE.Vector3(-u.z,0,u.x):new THREE.Vector3(u.z,0,-u.x);
   const point=(y,out)=>new THREE.Vector3(a[0],y,a[1]).addScaledVector(u,x+.0175).addScaledVector(n,out);
   const rail=(points,name)=>{const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.0175,6,false),mats[material]);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);};
   const top=out=>.88-(out-.16)*.075;
   for(const offset of [.82,1.28]){const bottom=offset<1.11?.15:.08;solid(edge,x,bottom,.035,top(offset)-bottom,offset,.035,material,'detail-entry-rail-post');}
   rail([point(.88,.16),point(top(1.40),1.40),point(top(1.40)-.11,1.47)],'detail-entry-rail-top');
   rail([point(.45,.82),point(.42,1.28)],'detail-entry-rail-mid');
  }
 }
 // Partial, directly observed broad enclosure extents from aerial-113027.
 // Coordinates are approximate fractions along each row, not a survey of
 // apartment boundaries or a claim about the unknown acquisition date.
 const bands=(balconySchedule?.rows||[]).flatMap(row=>row.segments.map(segment=>({...segment,section:row.section,floor:row.floor})));
 audit.detailEnclosures=[];
 for(const e of bands){const facade=spec.facades.find(f=>f.type==='loggia'&&f.section===e.section),o=audit.openings.find(v=>v.edge===facade.edge&&v.kind==='loggia'&&v.floor===e.floor),x=o.x+o.w*e.from,w=o.w*(e.to-e.from),y=o.y+spec.loggiaParapet,h=o.h-spec.loggiaParapet-.12,fw=.045;
  if(!(w>0&&h>0))throw Error('Invalid enclosure schedule');
  solid(o.edge,x,y,w,h,-.075,.025,'enclosure','detail-loggia-glass');root.children.at(-1).castShadow=false;
  for(const y0 of [y,y+h-fw])solid(o.edge,x,y0,w,fw,-.035,.05,e.frame==='dark'?'darkFrame':'frame','detail-loggia-rail');
  const panes=Math.max(1,Math.round(w/(e.panePitch??.7)));for(let k=0;k<=panes;k++)solid(o.edge,x+w*k/panes-fw/2,y,fw,h,-.035,.05,e.frame==='dark'?'darkFrame':'frame','detail-loggia-post');
  if(e.cover){solid(o.edge,x,y+h,w,.09,spec.roofBalconySetback/2*-1,spec.roofBalconySetback,e.cover==='red'?'redCover':e.cover==='light'?'lightCover':'canopy','detail-loggia-canopy');}
  audit.detailEnclosures.push({...e,edge:o.edge,x,w,y,h,panes,confidence:'approximate extent; undated aerial'});
 }
 // Open front portions retain a slim top rail, based on the authorised
 // Kajaka 8 structural comparison; individual finish remains approximate.
 for(const row of balconySchedule?.rows||[]){const facade=spec.facades.find(f=>f.type==='loggia'&&f.section===row.section),o=audit.openings.find(v=>v.edge===facade.edge&&v.kind==='loggia'&&v.floor===row.floor);let cursor=0;for(const seg of [...row.segments,{from:1,to:1}]){if(seg.from-cursor>.01)solid(o.edge,o.x+o.w*cursor,o.y+spec.loggiaParapet,o.w*(seg.from-cursor),.035,-.06,.05,'openRail','detail-open-balcony-rail');cursor=seg.to;}}

 // Roof finish replaces faces on their owning solids. No overlay cap or
 // duplicated lining is added over the already closed plain geometry.
 {
  root.updateMatrixWorld(true);
  const bodies=root.children.filter(m=>m.name.startsWith('parapet-')||m.name.startsWith('roof-divider-'));
  const deck=root.children.find(m=>m.name==='roof'),dg=deck.geometry.index?deck.geometry.toNonIndexed():deck.geometry.clone();dg.applyMatrix4(deck.matrixWorld);
  const dp=dg.attributes.position,deckTriangles=[],xCuts=new Set(),zCuts=new Set();
  for(let i=0;i<dp.count;i+=3){const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(dp,i+j));if(Math.abs(tri[0].y-spec.roofDatum)<1e-4){deckTriangles.push(tri);for(const p of tri){xCuts.add(p.x);zCuts.add(p.z);}}}
  dg.dispose();
  const overDeck=p=>deckTriangles.some(t=>{const a=t[0],b=t[1],c=t[2],det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-12)return false;const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/det,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/det;return u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8;});
  const topAt=p=>{const hits=new THREE.Raycaster(new THREE.Vector3(p.x,spec.roofDatum+2,p.z),new THREE.Vector3(0,-1,0),0,3).intersectObjects(bodies);return hits[0]?.point.y??spec.roofDatum;};
  const clip=(poly,axis,value,positive)=>{const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*(positive?1:-1),db=(b[axis]-value)*(positive?1:-1),ina=da>=-1e-10,inb=db>=-1e-10;if(ina)result.push(a);if(ina!==inb)result.push(a.clone().lerp(b,da/(da-db)));}return result;};
  const split=(parts,axis,value)=>parts.flatMap(poly=>{const vs=poly.map(p=>p[axis]);return Math.min(...vs)<value-1e-8&&Math.max(...vs)>value+1e-8?[clip(poly,axis,value,false),clip(poly,axis,value,true)]:[poly];});
  const stats={sourceMeshes:bodies.length,masonryFaces:0,liningFaces:0,metalFaces:0,foldReturn:.06,membraneTileMetres:16,dimensions:'Inferred from direct 2023 finish and user June2012 red-end relationship; retained roof/body levels'};
  for(const mesh of bodies){
   const world=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();world.applyMatrix4(mesh.matrixWorld);const p=world.attributes.position,groups=new Map();
   const match=mesh.name.match(/^parapet-(?:rear-)?(\d+)$/),edge=match?Number(match[1]):null;
   let red=true;if(edge!==null&&edge%2===0){const a=g[edge],b=g[(edge+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),along=((mesh.position.x-a[0])*(b[0]-a[0])+(mesh.position.z-a[1])*(b[1]-a[1]))/L;red=!mesh.name.startsWith('parapet-rear-')&&(along<.6||along>L-.6);}
   function emit(poly,normal,kind){if(poly.length<3)return;const rows=groups.get(kind)||{p:[],n:[],uv:[]};for(let k=1;k<poly.length-1;k++){const tri=[poly[0],poly[k],poly[k+1]],cross=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));if(cross.lengthSq()<1e-16)continue;for(const v of tri){rows.p.push(v.x,v.y,v.z);rows.n.push(normal.x,normal.y,normal.z);const horizontal=Math.abs(normal.y)>.5,u=horizontal?v.x:Math.abs(normal.x)>.5?v.z:v.x;rows.uv.push(u/(kind==='lining'?16:2.2),(horizontal?v.z:v.y)/(kind==='lining'?16:.996));}stats[kind==='masonry'?'masonryFaces':kind==='lining'?'liningFaces':'metalFaces']++;}groups.set(kind,rows);}
   for(let i=0;i<p.count;i+=3){const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)),normal=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).normalize();if(normal.lengthSq()<.5)continue;
    if(Math.abs(normal.y)>.5){emit(tri,normal,normal.y>0?'metal':red?'masonry':'metal');continue;}
    let parts=[tri];for(const x of xCuts)parts=split(parts,'x',x-normal.x*.02);for(const z of zCuts)parts=split(parts,'z',z-normal.z*.02);
    for(const part of parts){if(part.length<3)continue;const c=part.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(1/part.length),inside=overDeck(c.clone().addScaledVector(normal,.02)),kind=inside?'lining':red?'masonry':'metal',height=topAt(c.clone().addScaledVector(normal,-.01)),cut=height-.06;
     if(kind==='metal')emit(part,normal,'metal');else{emit(clip(part,'y',cut,false),normal,kind);emit(clip(part,'y',cut,true),normal,'metal');}
    }
   }
   world.dispose();
   for(const [kind,rows]of groups){if(!rows.p.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(rows.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(rows.n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(rows.uv,2));const m=new THREE.Mesh(geometry,kind==='masonry'?mats.red:kind==='lining'?mats.roofFinish:mats.roofEdgeMetal);m.name='roof-finish-'+mesh.name+'-'+kind;m.userData.roofFinishKind=kind;m.userData.roofOwner=mesh.name;m.castShadow=true;m.receiveShadow=true;root.add(m);}
  }
  for(const mesh of bodies){root.remove(mesh);mesh.geometry.dispose();}
  for(const m of root.children.filter(m=>m.name==='detail-roof-upstand-cap'))m.material=mats.roofEdgeMetal;
  audit.roofFinish=stats;
 }

 // Direct undated aerial: one small bent pipe beside each paired upstand,
 // and two conspicuous pale dish forms. Positions/profiles are approximate,
 // not a survey or evidence of the plumbing/equipment function.
 audit.roofFixtures=[];
 const localRoof=(section,fraction,depth,y)=>{const f=spec.facades.find(f=>f.type==='entrance'&&f.section===section),a=g[f.edge],b=g[(f.edge+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=new THREE.Vector3((b[0]-a[0])/L,0,(b[1]-a[1])/L),n=area<0?new THREE.Vector3(-u.z,0,u.x):new THREE.Vector3(u.z,0,-u.x);return {point:new THREE.Vector3(a[0],y,a[1]).addScaledVector(u,L*fraction).addScaledVector(n,-depth),u,n,edge:f.edge};};
 const attach=(geometry,material,name,position)=>{const m=new THREE.Mesh(geometry,material);m.position.copy(position);m.name=name;m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 for(const section of [1,2,3,4]){const r=localRoof(section,.62,2.65,spec.roofDatum),p=r.point;
  attach(new THREE.BoxGeometry(.22,.035,.22),mats.roofFinish,'detail-roof-pipe-flashing',p.clone().add(new THREE.Vector3(0,.0175,0)));
  const points=[p.clone().add(new THREE.Vector3(0,.02,0)),p.clone().add(new THREE.Vector3(0,.39,0)),p.clone().addScaledVector(r.u,.09).add(new THREE.Vector3(0,.49,0)),p.clone().addScaledVector(r.u,.19).add(new THREE.Vector3(0,.42,0))],curve=new THREE.CatmullRomCurve3(points);
  attach(new THREE.TubeGeometry(curve,24,.04,8,false),mats.ventCap,'detail-roof-bent-pipe',new THREE.Vector3());
  audit.roofFixtures.push({id:'S'+section+'-roof-pipe',kind:'bent-pipe',section,fraction:.62,depth:2.65,height:.53,confidence:'Visible aerial object; inferred size/position/profile'});
 }
 for(const [section,fraction,depth]of [[3,.90,7.8],[4,.22,6.4]]){const r=localRoof(section,fraction,depth,spec.roofDatum),p=r.point;
  attach(new THREE.BoxGeometry(.26,.04,.26),mats.roofEdgeMetal,'detail-roof-dish-foot',p.clone().add(new THREE.Vector3(0,.02,0)));
  attach(new THREE.CylinderGeometry(.025,.025,.43,8),mats.roofEdgeMetal,'detail-roof-dish-post',p.clone().add(new THREE.Vector3(0,.255,0)));
  const centre=p.clone().addScaledVector(r.n,-.12).add(new THREE.Vector3(0,.63,0)),bracket=new THREE.LineCurve3(p.clone().add(new THREE.Vector3(0,.47,0)),centre);
  attach(new THREE.TubeGeometry(bracket,1,.018,6,false),mats.roofEdgeMetal,'detail-roof-dish-bracket',new THREE.Vector3());
  const profile=[[0,-.015],[.15,.015],[.27,.075],[.27,.09],[.15,.03],[0,0]].map(p=>new THREE.Vector2(...p)),dish=attach(new THREE.LatheGeometry(profile,24),mats.frame,'detail-roof-dish',centre);
  dish.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),r.n.clone().multiplyScalar(-.8).add(new THREE.Vector3(0,.6,0)).normalize());
  audit.roofFixtures.push({id:'S'+section+'-roof-dish',kind:'dish',section,fraction,depth,diameter:.54,confidence:'Two conspicuous pale aerial dish forms interpreted; positions/orientation inferred'});
 }
 const dispose=root.userData.dispose;root.userData.dispose=()=>{dispose();Object.values(mats).forEach(m=>m.dispose());textures.forEach(t=>{if(!sharedMasonry?.includes(t)&&!sharedRoof?.includes(t))t.dispose();});};root.userData.detailScope='Provisional entrance-side material and framing study';return root;
}
