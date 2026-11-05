import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import type {Study} from '../kesk5/types.ts';
import {design as sister} from '../kesk5/config.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import {createOpenings} from './openings.ts';
import {finishSurfaces} from './finishes.ts';
import {balconies} from './balconies.ts';


function addressMap(text: string,width: number,height: number) {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#ebe9df';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#282b2b';ctx.lineWidth=height*.06;ctx.strokeRect(0,0,width,height);ctx.fillStyle='#282b2b';
  ctx.font=`bold ${Math.round(height*(text==='8'?.8:.42))}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height*.54,width*.86);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

// The canvas spans the whole southeast end, 0.25 m per 44 px, starting just above the plinth flashing.
const graffitiWidth=2048,graffitiHeight=512;
function graffitiMap() {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=graffitiWidth;canvas.height=graffitiHeight;
  const ctx=canvas.getContext('2d')!;
  ctx.textAlign='center';ctx.lineJoin='round';ctx.lineCap='round';
  const hand='italic 600 62px "Segoe Script","Comic Sans MS","Brush Script MT",cursive';
  ctx.font=hand;ctx.fillStyle=ctx.strokeStyle='rgba(216,222,220,.82)';ctx.lineWidth=2.5;
  for(const [line,x,y] of [['И каждый раз на век',1370,342],['прощайтесь когда уходите',1345,412],['на миг.',1420,478]] as const){ctx.fillText(line,x,y,650);ctx.strokeText(line,x,y,650);}
  ctx.font='italic 600 34px "Segoe Script","Comic Sans MS",cursive';ctx.fillStyle='rgba(52,50,46,.72)';ctx.fillText('Руслан',1925,392);
  ctx.strokeStyle='rgba(214,220,218,.7)';ctx.lineWidth=7;
  ctx.beginPath();ctx.moveTo(735,440);ctx.lineTo(760,350);ctx.lineTo(778,445);ctx.moveTo(748,405);ctx.lineTo(772,402);ctx.moveTo(800,440);ctx.lineTo(796,372);ctx.quadraticCurveTo(835,360,808,400);ctx.lineTo(835,442);ctx.stroke();
  ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(102,472);ctx.bezierCurveTo(30,420,62,350,102,392);ctx.bezierCurveTo(142,350,176,420,102,472);ctx.stroke();
  // Weathering eats through the paint along the mortar and brick faces.
  ctx.globalCompositeOperation='destination-out';let seed=8147;
  for(let i=0;i<9000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%graffitiWidth;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%graffitiHeight;ctx.fillRect(x,y,1+seed%5,1+(seed>>>8)%3);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

export function createDetailed(context: OverrideContext) {
  const model=createOpenings(context,true),root=model.root as Study,audit=root.userData.audit;
  const finish=finishSurfaces(root),address=addressMap('8',240,272),street=addressMap('Kajaka tn',336,160),graffiti=graffitiMap();
  const materials={
    light:new THREE.MeshStandardMaterial({color:0xd7d9d3,roughness:.72}),
    white:new THREE.MeshStandardMaterial({color:0xeeeeea,roughness:.5}),
    dark:new THREE.MeshStandardMaterial({color:0x56302a,roughness:.8}),
    timber:new THREE.MeshStandardMaterial({color:0x75624c,roughness:.9}),
    sheet:new THREE.MeshStandardMaterial({color:0x5c5f5c,roughness:.8}),
    curtain:new THREE.MeshStandardMaterial({color:0xddd9cb,roughness:1}),
    open:new THREE.MeshStandardMaterial({color:0x4f8066,roughness:.8}),
    render:new THREE.MeshStandardMaterial({color:0xb4b8b7,roughness:.95}),
    joint:new THREE.MeshStandardMaterial({color:0x5f4d42,roughness:1}),
    glass:new THREE.MeshStandardMaterial({color:0xaebfc0,transparent:true,opacity:.42,depthWrite:false,roughness:.3}),
    street:new THREE.MeshStandardMaterial({color:0xffffff,map:street,roughness:.8}),
    plaque:new THREE.MeshStandardMaterial({color:0xffffff,map:address,roughness:.8}),
    graffiti:new THREE.MeshStandardMaterial({color:0xffffff,map:graffiti,transparent:true,depthWrite:false,roughness:1}),
  };
  const plan=audit.localFootprint;
  function frame(edge:number){
    const a=plan[edge],b=plan[(edge+1)%plan.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const group=new THREE.Group();group.position.set(a[0],0,a[1]);group.rotation.y=-Math.atan2(dz,dx);group.updateMatrix();
    return {matrix:group.matrix,length:Math.hypot(dx,dz)};
  }
  function part(edge:number,name:string,geometry:THREE.BufferGeometry,mat:THREE.MeshStandardMaterial,x:number,y:number,out:number) {
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,out);mesh.applyMatrix4(frame(edge).matrix);
    mesh.castShadow=mat!==materials.glass;mesh.receiveShadow=true;mesh.name=name;root.add(mesh);return mesh;
  }
  function box(edge:number,name:string,x:number,y:number,w:number,h:number,out:number,d:number,mat:THREE.MeshStandardMaterial){
    return part(edge,name,new THREE.BoxGeometry(w,h,d),mat,x+w/2,y+h/2,out);
  }
  for(const row of balconies.rows){
    const face=audit.facadeEdges.find(f=>f.type==='loggia'&&f.section===row.section)!;
    const o=audit.openings.find(v=>v.kind==='loggia'&&v.edge===face.edge&&v.floor===row.floor)!;
    const y=o.y+sister.loggiaParapet,h=o.h-sister.loggiaParapet-.12;
    let end=0;
    box(face.edge,'parapet-flashing',o.x,y-.035,o.w,.035,-.05,.14,finish.coping);
    const rail=(from:number,to:number)=>box(face.edge,'open-balcony-rail',o.x+from*o.w,y+.02,(to-from)*o.w,.05,-.06,.06,materials.open);
    for(const seg of row.segments){
      const x=o.x+seg.from*o.w,w=(seg.to-seg.from)*o.w,mat=materials[seg.frame as 'light'|'white'|'dark'|'timber'];
      const bar=seg.frame==='white'?.075:seg.frame==='timber'?.07:.04;
      if(seg.from>end)rail(end,seg.from);
      box(face.edge,'balcony-glazing',x,y,w,h,-.075,.025,materials.glass);
      for(const by of [y,y+h-bar])box(face.edge,'balcony-crossbar',x,by,w,bar,-.035,.05,mat);
      if(seg.top)box(face.edge,'balcony-transom',x,y+h*(1-seg.top),w,bar*.8,-.035,.05,mat);
      if(seg.fascia)box(face.edge,'balcony-fascia',x,y+h-.3,w,.3,-.03,.06,materials.dark);
      const panes=Math.max(1,Math.round(w/(seg.panePitch??.74)));
      for(let i=0;i<=panes;i++) {
        // Shared segment boundaries have a single post and remain inside the bay.
        if(i===0 && seg.from>0 && seg.from===end)continue;
        box(face.edge,'balcony-post',x+(w-bar)*i/panes,y+bar,bar,h-2*bar,-.035,.05,mat);
        if(seg.curtains&&i<panes)box(face.edge,'balcony-curtain',x+w*(i+.2)/panes,y+bar,w/panes*.6,h*(1-(seg.top??0))-bar,-.2,.02,materials.curtain);
      }
      if(seg.cover==='sheet'){
        const span=sister.roofBalconySetback+.12,slope=new THREE.BoxGeometry(w,.06,span);slope.rotateX(.14);
        part(face.edge,'lean-to-cover',slope,materials.sheet,x+w/2,y+h+.1,-span/2+.1);
      }else if(seg.cover)box(face.edge,'top-balcony-cover',x,y+h,w,.085,-sister.roofBalconySetback/2,sister.roofBalconySetback,materials.light);
      end=seg.to;
    }
    if(end<1)rail(end,1);
  }
  const vents=root.children.filter(m=>m.name==='roof-vent');
  for(const body of vents) {
    const {width,height,depth}=(body.geometry as THREE.BoxGeometry).parameters;
    const cap=new THREE.Mesh(new THREE.BoxGeometry(width+.055,.045,depth+.055),finish.coping);
    cap.name='vent-cap';cap.position.copy(body.position);cap.position.y+=height/2+.0225;
    cap.rotation.copy(body.rotation);cap.castShadow=cap.receiveShadow=true;root.add(cap);
  }
  const rear=audit.facadeEdges.find(f=>f.section===4&&f.type==='loggia')!.edge;
  const dishX=frame(rear).length*.055,dishY=sister.roofDatum-.4;
  box(rear,'dish-anchor',dishX-.075,dishY-.15,.15,.3,.03,.07,finish.coping);
  box(rear,'dish-bracket',dishX-.02,dishY-.025,.04,.05,.16,.26,finish.coping);
  const profile=[[0,-.015],[.15,.015],[.27,.075],[.27,.09],[.15,.03],[0,0]].map(([x,y])=>new THREE.Vector2(x,y));
  const dishGeometry=new THREE.LatheGeometry(profile,24);dishGeometry.rotateX(1.1);
  part(rear,'river-dish',dishGeometry,materials.light,dishX,dishY,.30);
  const endWall=(rear+1)%plan.length;
  const endLength=frame(endWall).length,flashing=.98;
  // Placed from May 2024 Street View: plates near the road corner, about 2.4 m above the flashing.
  part(endWall,'address-8',new THREE.PlaneGeometry(.3,.34),materials.plaque,endLength-.75,flashing+2.48,.02).castShadow=false;
  part(endWall,'street-address',new THREE.PlaneGeometry(.42,.2),materials.street,endLength-.75,flashing+2.06,.02).castShadow=false;
  box(endWall,'end-plinth-render',0,-1.15,endLength,flashing+1.15,.015,.03,materials.render);
  box(endWall,'end-plinth-flashing',0,flashing,endLength,.035,.04,.08,finish.coping);
  box(endWall,'end-wall-joint',endLength*.84,flashing,.014,sister.roofDatum-flashing,.002,.006,materials.joint);
  const span=endLength*graffitiHeight/graffitiWidth;
  const tag=part(endWall,'end-wall-graffiti',new THREE.PlaneGeometry(endLength,span),materials.graffiti,endLength/2,flashing+.1+span/2,.012);
  tag.castShadow=false;tag.renderOrder=1;tag.visible=!!graffiti;

  const opaque=new THREE.Group();
  for(const mesh of [...root.children])if(mesh instanceof THREE.Mesh && !(mesh instanceof THREE.InstancedMesh) && !mesh.material.transparent)opaque.add(mesh);
  batchDetailStudy(opaque);root.add(opaque);
  root.userData.detailReview={roofHousings:vents.length,balconyRows:balconies.rows.length,batched:opaque.userData.batchStats};
  return {...model,ready:finish.ready,setTextures(on:boolean){finish.toggle(on);materials.plaque.map=on?address:null;materials.plaque.needsUpdate=true;materials.street.map=on?street:null;materials.street.needsUpdate=true;tag.visible=on&&!!graffiti;},dispose(){
    model.dispose();finish.dispose();address?.dispose();street?.dispose();graffiti?.dispose();Object.values(materials).forEach(m=>m.dispose());
  }};
}
