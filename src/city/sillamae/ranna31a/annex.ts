import * as THREE from 'three';
import type {OverrideContext,Point2} from '../../../engine/types.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import {sourcePoint,frontDesign as tower} from './front-design.ts';
import {roundedPipe} from './services.ts';
import {acquirePaleMasonry} from '../shared/masonry.ts';
import {surfaces} from '../kesk1/surfaces.ts';
import {splitPolygon} from '../../../engine/survey/carve.ts';
import {annexDesign as d,annexOutline as ring,annexSchedule,type AnnexOpening} from './annex-design.ts';

export function createAnnex(context:OverrideContext,datum:number,masonry?:THREE.MeshStandardMaterial) {
  const root=new THREE.Group(),schedule=annexSchedule(),materials={
    wall:new THREE.MeshStandardMaterial({name:'annex-plain-wall',color:'#c4c1b8',roughness:1}),
    concrete:new THREE.MeshStandardMaterial({name:'annex-concrete',color:'#aaaead',roughness:1}),
    base:new THREE.MeshStandardMaterial({name:'annex-base-coat',color:'#b88165',roughness:1}),
    white:new THREE.MeshStandardMaterial({name:'annex-pale-insert',color:'#d0d2c9',roughness:1}),
    paleBrick:new THREE.MeshStandardMaterial({name:'annex-corner-pale-brick',color:'#e1ded1',roughness:1,bumpScale:.024}),
    metal:new THREE.MeshStandardMaterial({name:'annex-corner-metal-caps',color:'#424741',roughness:.65,metalness:.35}),
    timber:new THREE.MeshStandardMaterial({name:'annex-brown-window-frame',color:'#49342a',roughness:.9}),
    glass:new THREE.MeshStandardMaterial({name:'annex-glazing',color:'#74858c',roughness:.8}),
    door:new THREE.MeshStandardMaterial({name:'annex-door',color:'#666461',roughness:1}),
    // Owner photos: the wing doors are painted maroon.
    maroon:new THREE.MeshStandardMaterial({name:'annex-maroon-door',color:'#5b2a28',roughness:.85}),
    core:new THREE.MeshStandardMaterial({name:'annex-slab-core',color:'#55574f',roughness:1}),
    gate:new THREE.MeshStandardMaterial({name:'annex-red-steel-gate',color:'#7e3a2e',roughness:.75,metalness:.2}),
    roof:new THREE.MeshStandardMaterial({name:'annex-roof',color:'#737670',roughness:1}),
    pipe:new THREE.MeshStandardMaterial({name:'gas-pipe-yellow',color:'#eeb333',roughness:.65}),
  };
  const pale=acquirePaleMasonry();[materials.paleBrick.map,materials.paleBrick.bumpMap]=pale.maps;
  // Owner request: the tower's weathered dark felt on every roof deck and flashing of the wing.
  const felt=surfaces(),feltMaps=[felt.maps['felt-colour-v1'][0],felt.maps['felt-relief-v1'][0]] as const;
  [materials.roof.map,materials.roof.bumpMap]=feltMaps;materials.roof.bumpScale=.028;
  let ready=felt.ready.then(()=>{});
  const concreteMap=typeof document==='undefined'?null:new THREE.Texture();
  if(concreteMap)ready=Promise.all([ready,new THREE.TextureLoader().loadAsync(new URL('../kesk1/textures/concrete-v1-0.png',import.meta.url).href).then(t=>{concreteMap.image=t.image;concreteMap.needsUpdate=true;t.dispose();})]).then(()=>{});
  if(concreteMap){concreteMap.wrapS=concreteMap.wrapT=THREE.RepeatWrapping;concreteMap.colorSpace=THREE.SRGBColorSpace;concreteMap.anisotropy=8;materials.concrete.map=concreteMap;materials.concrete.bumpMap=concreteMap;materials.concrete.bumpScale=.018;materials.concrete.color.set('#b7b2a7');}
  const Y=(source:number)=>source-datum;
  const add=(g:THREE.BufferGeometry,m:THREE.MeshStandardMaterial,name:string)=>{
    // Owner street and sea-side photos: every plain wall of the wing is the tower's red brick.
    if(masonry&&m===materials.wall)m=masonry;
    // Vertical faces run their texture along the face itself; most walls here are oblique to the axes.
    if(m===masonry||m===materials.paleBrick||m===materials.concrete){const brick=m!==materials.concrete,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++){const flat=Math.abs(n.getY(i))>.5,h=Math.hypot(n.getX(i),n.getZ(i))||1;uv.setXY(i,(flat?p.getX(i):(p.getZ(i)*n.getX(i)-p.getX(i)*n.getZ(i))/h)/(brick?2.2:1.2),(flat?p.getZ(i):p.getY(i))/(brick?.996:1.2));}}
    // Extrusion UVs are in metres; the felt tile reads at about 6 m.
    if(m===materials.roof){const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/6,uv.getY(i)/6);}
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  function prism(name:string,outline:Point2[],low:number,high:number,material=materials.wall) {
    const shape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z))),g=new THREE.ExtrudeGeometry(shape,{depth:high-low,bevelEnabled:false,steps:1});
    g.rotateX(-Math.PI/2);g.translate(0,Y(low),0);return add(g,material,name);
  }
  function inset(outline:Point2[],width:number):Point2[] {
    const sign=Math.sign(outline.reduce((sum,a,i)=>{const b=outline[(i+1)%outline.length];return sum+a[0]*b[1]-b[0]*a[1];},0));
    const normals=outline.map((a,i)=>{const b=outline[(i+1)%outline.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);return [-(b[1]-a[1])/length*sign,(b[0]-a[0])/length*sign];});
    return outline.map((p,i)=>{const a=normals[(i+outline.length-1)%outline.length],b=normals[i],scale=width/(1+a[0]*b[0]+a[1]*b[1]);return [p[0]+(a[0]+b[0])*scale,p[1]+(a[1]+b[1])*scale];});
  }
  function frame(edge:number) {
    const a=ring[edge],b=ring[(edge+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
    return {length,at:(u:number,depth=0):Point2=>[a[0]+ux*u-uz*depth,a[1]+uz*u+ux*depth],matrix:new THREE.Matrix4().makeBasis(new THREE.Vector3(ux,0,uz),new THREE.Vector3(0,1,0),new THREE.Vector3(-uz,0,ux)).setPosition(a[0],-datum,a[1])};
  }
  function path(o:AnnexOpening,pad=0) {
    const a=o.u-o.width/2-pad,b=o.u+o.width/2+pad,bottom=o.bottom-pad,top=o.top+pad;
    if(o.kind!=='arch')return [[a,bottom],[b,bottom],[b,top],[a,top]];
    const radius=(b-a)/2,spring=top-radius;
    return [[a,bottom],[b,bottom],...Array.from({length:25},(_,i)=>{const angle=Math.PI*i/24;return [o.u+Math.cos(angle)*radius,spring+Math.sin(angle)*radius];})];
  }
  function wall(edge:number,top:number,openings:AnnexOpening[],from=0,to=frame(edge).length,inset=0) {
    const plain=frame(edge),f={length:plain.length,at:(u:number,depth=0)=>plain.at(u,depth-inset),matrix:plain.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,-inset))},shape=new THREE.Shape([[from,d.base],[to,d.base],[to,top],[from,top]].map(([x,y])=>new THREE.Vector2(x,y)));
    for(const o of openings)shape.holes.push(new THREE.Path(path(o).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    const g=new THREE.ExtrudeGeometry(shape,{depth:d.wall,bevelEnabled:false,steps:1});g.translate(0,0,-d.wall);g.applyMatrix4(f.matrix);add(g,edge===9?materials.paleBrick:materials.wall,'annex-wall-'+edge);
    const [a,b]=[f.at(from,.05),f.at(to,.05)],inside=[f.at(to,-d.wall-.05),f.at(from,-d.wall-.05)];
    if(edge!==9)prism('annex-coping-'+edge,[a,b,...inside],top,top+.055,materials.roof);
    for(const o of openings) {
      const face=new THREE.ShapeGeometry(new THREE.Shape(path(o).map(([x,y])=>new THREE.Vector2(x,y))));face.translate(0,0,-.14);face.applyMatrix4(f.matrix);add(face,o.kind==='window'||o.kind==='arch'?materials.glass:o.kind==='gate'?materials.gate:[0,1,3].includes(o.edge)?materials.maroon:materials.door,o.id+'-infill');
      if(o.kind==='gate') {
        const seam=new THREE.BoxGeometry(.05,o.top-o.bottom,.03);seam.translate(o.u,(o.bottom+o.top)/2,-.125);seam.applyMatrix4(f.matrix);add(seam,materials.metal,o.id+'-leaf-joint');
      }
      const courtyard=o.edge===11&&o.kind==='window',corner=o.edge===9;
      let surround:THREE.Shape;
      if(o.kind==='arch') {
        const radius=o.width/2,left=o.u-radius,right=o.u+radius,spring=o.top-radius;
        // Owner sea-side photo: legs .36 wide from .4 below the springing, a deep head block .66 proud of each side reaching just below the crown.
        const outline=[[left-.36,spring-.4],[left-.36,o.top-.05],[left-.66,o.top-.05],[left-.66,o.top+.56],[right+.66,o.top+.56],[right+.66,o.top-.05],[right+.36,o.top-.05],[right+.36,spring-.4],[right,spring-.4],[right,spring],...Array.from({length:25},(_,i)=>[o.u+radius*Math.cos(Math.PI*i/24),spring+radius*Math.sin(Math.PI*i/24)]),[left,spring-.4]];
        surround=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
      } else if(courtyard||corner) {
        surround=new THREE.Shape(path(o).map(([x,y])=>new THREE.Vector2(x,y)));surround.holes.push(new THREE.Path(path(o,-.055).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
      } else {
        surround=new THREE.Shape(path(o,.12).map(([x,y])=>new THREE.Vector2(x,y)));surround.holes.push(new THREE.Path(path(o).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
      }
      const frameMaterial=courtyard?materials.timber:o.kind==='gate'?materials.metal:materials.white;
      const trim=new THREE.ExtrudeGeometry(surround,{depth:.06,bevelEnabled:false,steps:1});trim.translate(0,0,o.kind==='arch'?0:-.11);trim.applyMatrix4(f.matrix);add(trim,o.kind==='arch'?materials.concrete:frameMaterial,o.id+'-frame');
      if(courtyard||corner) {
        const lintel=new THREE.BoxGeometry(o.width+(corner?.22:.4),.12,.16);lintel.translate(o.u,o.top+.08,.02);lintel.applyMatrix4(f.matrix);add(lintel,materials.concrete,o.id+'-lintel');
      }
      if(o.kind==='window'||o.kind==='arch') {
        let sill:THREE.BufferGeometry;
        if(o.edge===11||o.edge===8) {
          const section=new THREE.Shape((courtyard?[[-.06,o.bottom-.03],[.26,o.bottom-.35],[.26,o.bottom-.5],[-.06,o.bottom-.18]]:[[-.06,o.bottom-.03],[.4,o.bottom-.28],[.4,o.bottom-.4],[-.06,o.bottom-.15]]).map(([z,y])=>new THREE.Vector2(z,y)));
          sill=new THREE.ExtrudeGeometry(section,{depth:o.width+.18,bevelEnabled:false,steps:1});sill.rotateY(-Math.PI/2);sill.translate(o.u+(o.width+.18)/2,0,0);
        } else {sill=new THREE.BoxGeometry(o.width+(corner?.1:.18),corner?.05:.12,corner?.15:.35);sill.translate(o.u,o.bottom-(corner?.035:.09),.015);}
        sill.applyMatrix4(f.matrix);add(sill,corner?materials.metal:materials.concrete,o.id+'-sill');
        if(o.grid) {
          // Owner photos: gridded arch glazing, dark timber on the sea side and white at the rear, with rails at the springing and halfway down.
          const spring=o.top-o.width/2,columns=o.columns??3,grid=o.white?materials.white:materials.timber;
          for(let k=1;k<columns;k++){const bar=new THREE.BoxGeometry(.05,o.top-o.bottom-.08,.04);bar.translate(o.u+o.width*(k/columns-.5),(o.bottom+o.top)/2-.04,-.105);bar.applyMatrix4(f.matrix);add(bar,grid,o.id+'-mullion');}
          for(const y of [spring,(spring+o.bottom)/2]){const rail=new THREE.BoxGeometry(o.width-.06,.05,.04);rail.translate(o.u,y,-.105);rail.applyMatrix4(f.matrix);add(rail,grid,o.id+'-transom');}
        } else {
          if(!courtyard&&!corner) {
            const bar=new THREE.BoxGeometry(.045,o.top-o.bottom-.08,.04);bar.translate(o.u,(o.bottom+o.top)/2,-.105);bar.applyMatrix4(f.matrix);add(bar,materials.white,o.id+'-mullion');
          }
          if(!corner){const rail=new THREE.BoxGeometry(o.width-.06,courtyard?.09:.045,.04);rail.translate(o.u,o.kind==='arch'?o.top-o.width/2:o.top-.55,-.105);rail.applyMatrix4(f.matrix);add(rail,frameMaterial,o.id+'-transom');}
        }
      }
    }
  }
  const corner3=frame(3),corner4=frame(4),cut=d.westCorner.cut;
  const r=d.rearBody,stepU=corner3.length-cut-r.step;
  for(let edge=0;edge<ring.length-1;edge++) {
    const top=edge===9?12.65:edge===1||edge===2?r.top:d.parapet,openings=schedule.filter(o=>o.edge===edge);
    const rr=d.rearRecess;
    if(edge===3){wall(3,r.top,openings,0,stepU);wall(3,d.parapet,[],stepU,corner3.length-cut);}
    else if(edge===2){wall(2,top,[],0,rr.from);wall(2,top,openings,rr.from,rr.to,rr.depth);wall(2,top,[],rr.to,frame(2).length);}
    else wall(edge,top,openings,edge===4?cut:0,frame(edge).length);
  }
  for(const edge of [1,2]) {
    const f=frame(edge),p=d.rearPlinth,ground=entranceDatum(context.ground,[sourcePoint(...f.at(f.length/2,1))]);
    if(ground===null)throw Error('Annex rear plinth needs land');
    prism('annex-rear-plinth-'+edge,[f.at(0,p.proud),f.at(f.length,p.proud),f.at(f.length,-d.rearRecess.depth-.02),f.at(0,-d.rearRecess.depth-.02)],d.base,ground+p.height,materials.concrete);
  }
  {
    // Concrete block at the step of the sea wall, proud of both faces.
    prism('annex-sea-wall-step-block',[corner3.at(stepU-.35,.1),corner3.at(stepU,.1),corner3.at(stepU,-d.wall-.06),corner3.at(stepU-.35,-d.wall-.06)],d.parapet-.2,r.top+.06,materials.concrete);
    const p0=corner3.at(stepU),vent=d.ventBlock.outline;
    const body:Point2[]=[p0,vent[0],vent[1],d.upper[2],d.upper[1],ring[1],ring[2],ring[3]];
    prism('annex-rear-body-roof',inset(body,.05),r.roof-.16,r.roof,materials.roof);
    // Fronts of the raised body over the low street roof, on the body side of each line; the vent block and the upper volume close the rest.
    for(const [i,[a,b]] of [[p0,vent[0]],[vent[1],d.upper[2]],[d.upper[1],ring[1]]].entries()) {
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      profileWall('annex-rear-body-front-'+i,a,b,[[0,d.roof-.16],[length,d.roof-.16],[length,r.top],[0,r.top]],d.wall);
      profileWall('annex-rear-body-coping-'+i,a,b,[[0,r.top],[length,r.top],[length,r.top+.055],[0,r.top+.055]],d.wall+.1,materials.roof,.05);
    }
  }
  {
    const w=d.westCorner,a=corner3.at(corner3.length-cut),b=corner4.at(cut),length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
    const at=(u:number,depth:number):Point2=>[a[0]+ux*u-uz*depth,a[1]+uz*u+ux*depth],quad=(u0:number,u1:number,front:number,back:number)=>[at(u0,front),at(u1,front),at(u1,back),at(u0,back)];
    prism('annex-west-corner-concrete-panel',quad(0,length,0,-d.wall),d.base,w.drain.slabBottom+.01,materials.concrete);
    const l=w.ledge,sea=d.wings.find(s=>s.edge===3)!,end=sea.landing[1],p=l.projection,band=(name:string,outline:Point2[])=>prism(name,outline,l.bottom,l.top,materials.concrete);
    band('annex-west-street-ledge',[corner4.at(l.from,p),corner4.at(corner4.length,p),corner4.at(corner4.length,0),corner4.at(l.from,0)]);
    // Round the landing's end face and along the sea wall to the corner panel; the stair wall's own ledge meets it at the landing corner.
    band('annex-sea-landing-end-ledge',[corner3.at(end,sea.depth),corner3.at(end+p,sea.depth),corner3.at(end+p,0),corner3.at(end,0)]);
    band('annex-sea-corner-ledge',[corner3.at(end+p,p),corner3.at(corner3.length-cut,p),corner3.at(corner3.length-cut,0),corner3.at(end+p,0)]);
  }
  {
    // Owner street photo: the three street windows sit in one white-brick panel under a thin concrete lintel; a concrete ledge runs the wall just under the gas pipe.
    const f=frame(8),rows=schedule.filter(o=>o.edge===8),left=rows[0].u-rows[0].width/2-.27,right=rows.at(-1)!.u+rows.at(-1)!.width/2+.27,bottom=rows[0].bottom-.6,top=rows[0].top+.05;
    const panel=new THREE.Shape([[left,bottom],[right,bottom],[right,top],[left,top]].map(([x,y])=>new THREE.Vector2(x,y)));
    for(const o of rows)panel.holes.push(new THREE.Path(path(o).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    const skin=new THREE.ExtrudeGeometry(panel,{depth:.02,bevelEnabled:false,steps:1});skin.applyMatrix4(f.matrix);add(skin,materials.paleBrick,'annex-street-pale-panel');
    const lintel=new THREE.BoxGeometry(right-left+.06,.11,.08);lintel.translate((left+right)/2,top+.055,.02);lintel.applyMatrix4(f.matrix);add(lintel,materials.concrete,'annex-street-lintel');
    const ledgeTop=datum+1.25-tower.lift-.07,ledge=new THREE.BoxGeometry(f.length,.37,.12);ledge.translate(f.length/2,ledgeTop-.185,.06);ledge.applyMatrix4(f.matrix);add(ledge,materials.concrete,'annex-street-ledge');
  }
  // Both chamfers are roof outlets: the flat roof is cut back behind each so water runs between the blades onto the slab.
  const east=frame(9),west=(()=>{
    const c=frame(3),a=c.at(c.length-d.westCorner.cut),b=frame(4).at(d.westCorner.cut),length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
    return {length,at:(u:number,depth=0):Point2=>[a[0]+ux*u-uz*depth,a[1]+uz*u+ux*depth]};
  })();
  const roofRing=inset(ring,d.wall),notch=d.drain.notch;
  roofRing.splice(10,0,east.at(0,-notch),east.at(east.length,-notch));
  roofRing.splice(4,1,frame(3).at(frame(3).length-d.westCorner.cut,-d.wall),west.at(0,-notch),west.at(west.length,-notch),frame(4).at(d.westCorner.cut,-d.wall));
  prism('annex-flat-roof',roofRing,d.roof-.16,d.roof,materials.roof);
  function drainOutlet(name:string,f:{length:number,at:(u:number,depth?:number)=>Point2},c:{slabBottom:number,slabTop:number,front:number,top:number}) {
    const {blade,bladeDepth}=d.drain,quad=(u0:number,u1:number,front:number,back:number)=>[f.at(u0,front),f.at(u1,front),f.at(u1,back),f.at(u0,back)];
    prism(name+'-slab',quad(-.1,f.length+.1,c.front,-notch),c.slabBottom,c.slabTop,materials.concrete);
    for(const [i,u] of [0,f.length-blade].entries()) {
      prism(name+'-blade-'+i,quad(u,u+blade,.03,-bladeDepth),c.slabTop,c.top);
      prism(name+'-blade-cap-'+i,quad(u-.06,u+blade+.06,.1,-bladeDepth-.07),c.top,c.top+.035,materials.metal);
    }
    // Dark metal chute from the cut roof edge down to the slab's front, between the blades.
    const section=new THREE.Shape([[-notch,d.roof],[c.front,c.slabTop+.01],[c.front,c.slabTop+.04],[-notch,d.roof+.03]].map(([x,y])=>new THREE.Vector2(x,y)));
    const chute=new THREE.ExtrudeGeometry(section,{depth:f.length-2*blade,bevelEnabled:false,steps:1});
    // Basis (outward, up, backwards along the face) keeps the extrusion right-handed.
    const [o,n,e,start]=[f.at(0),f.at(0,1),f.at(1),f.at(f.length-blade)];
    chute.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(n[0]-o[0],0,n[1]-o[1]),new THREE.Vector3(0,1,0),new THREE.Vector3(o[0]-e[0],0,o[1]-e[1])).setPosition(start[0],-datum,start[1]));
    add(chute,materials.metal,name+'-chute');
  }
  drainOutlet('annex-east-corner',east,d.eastCorner);drainOutlet('annex-west-corner',west,d.westCorner.drain);
  {
    // The garage wall itself stops at the parapet, hidden inside the box; the box face stands on the slab edge.
    const f=frame(6),g=d.garage,quad=(a:number,b:number,front:number,back:number)=>[f.at(a,front),f.at(b,front),f.at(b,back),f.at(a,back)];
    prism('annex-garage-box',quad(g.left,g.right,g.projection,-g.depth),g.slabTop,d.garageTop-.1);
    prism('annex-garage-box-roof',quad(g.left-.04,g.right+.04,g.projection+.04,-g.depth-.04),d.garageTop-.1,d.garageTop+.03,materials.roof);
    const edge=g.projection-.04;
    prism('annex-garage-hollow-core-slab',quad(g.left,g.right,edge,-g.depth),g.slabBottom,g.slabTop,materials.concrete);
    const [first,last,count]=g.cores;
    for(let i=0;i<count;i++) {
      const core=new THREE.CircleGeometry(.08,16);core.translate(first+(last-first)*i/(count-1),(g.slabBottom+g.slabTop)/2,edge+.004);core.applyMatrix4(f.matrix);add(core,materials.core,'annex-garage-slab-core-'+i);
    }
    for(const [i,[a,b]] of g.corbels.entries())prism('annex-garage-corbel-'+i,quad(a,b,edge,0),g.corbelBottom,g.slabBottom+.01,materials.concrete);
  }
  // Vertical wall in plan from a to b, outward normal on its left; profile is [u, height] pairs.
  function profileWall(name:string,a:Point2,b:Point2,profile:number[][],depth:number,material=materials.wall,offset=0) {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
    const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(profile.map(([x,y])=>new THREE.Vector2(x,y))),{depth,bevelEnabled:false,steps:1});geometry.translate(0,0,offset-depth);
    geometry.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux,0,uz),new THREE.Vector3(0,1,0),new THREE.Vector3(-uz,0,ux)).setPosition(a[0],-datum,a[1]));return add(geometry,material,name);
  }
  const [back0,back1,front1,front0]=d.upper,depthOf=(p:Point2)=>{const nx=front0[1]-front1[1],nz=front1[0]-front0[0],l=Math.hypot(nx,nz);return ((p[0]-front0[0])*nx+(p[1]-front0[1])*nz)/l;};
  const upperDepth=depthOf(back0),upperAt=(p:Point2)=>d.upperFront+(d.upperBack-d.upperFront)*depthOf(p)/upperDepth;
  // The ring runs anticlockwise, so these walls stand inside it; side walls stop 5 cm short of the blade face, which would otherwise share their end faces.
  const behind=(p:Point2,q:Point2):Point2=>{const l=Math.hypot(q[0]-p[0],q[1]-p[1]);return [p[0]+(q[0]-p[0])*.05/l,p[1]+(q[1]-p[1])*.05/l];};
  for(const [i,[a,b]] of [[back0,back1],[back1,behind(front1,back1)],[behind(front0,back0),back0]].entries()) {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    profileWall('annex-upper-wall-'+i,a,b,[[0,d.roof],[length,d.roof],[length,upperAt(b)],[0,upperAt(a)]],d.wall,materials.wall,d.wall);
  }
  {
    const roof=new THREE.ExtrudeGeometry(new THREE.Shape(inset(d.upper,.05).map(([x,z])=>new THREE.Vector2(x,-z))),{depth:.15,bevelEnabled:false,steps:1});roof.rotateX(-Math.PI/2);
    const p=roof.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+upperAt([p.getX(i),p.getZ(i)])-.12-datum);
    roof.computeVertexNormals();add(roof,materials.roof,'annex-upper-roof');
  }
  {
    const b=d.blade,length=Math.hypot(b.to[0]-b.from[0],b.to[1]-b.from[1]);
    profileWall('annex-cross-blade',b.from,b.to,[[0,d.roof],[length,d.roof],[length,b.end],[b.peakU,b.peak],[0,b.low]],b.thickness);
    profileWall('annex-cross-blade-coping',b.from,b.to,[[-.04,b.low-.01],[b.peakU,b.peak-.01],[length+.04,b.end-.01],[length+.04,b.end+.05],[b.peakU,b.peak+.05],[-.04,b.low+.05]],b.thickness+.08,materials.roof,.04);
    const c=b.cross;
    for(const [w,h] of [[c.bar,c.height],[c.width,c.bar]])profileWall('annex-blade-sunk-cross',b.from,b.to,[[c.u-w/2,c.y-h/2],[c.u+w/2,c.y-h/2],[c.u+w/2,c.y+h/2],[c.u-w/2,c.y+h/2]],.01,materials.core,.004);
    const metal=b.peakU;
    for(const [w,h,y] of [[.05,.62,b.peak+.31],[.34,.05,b.peak+.42]])profileWall('annex-blade-metal-cross',b.from,b.to,[[metal-w/2,y-h/2],[metal+w/2,y-h/2],[metal+w/2,y+h/2],[metal-w/2,y+h/2]],.05,materials.metal,-b.thickness/2+.025);
  }
  {
    const v=d.ventBlock,[a,b]=v.outline,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    prism('annex-vent-block',v.outline,d.roof-.16,v.top-.06);
    prism('annex-vent-block-coping',inset(v.outline,-.04),v.top-.06,v.top,materials.roof);
    for(const [i,u] of v.vents.entries()) {
      const vent=new THREE.CircleGeometry(.07,16),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
      vent.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux,0,uz),new THREE.Vector3(0,1,0),new THREE.Vector3(-uz,0,ux)).setPosition(a[0]+ux*u-uz*.004,v.ventHeight-datum,a[1]+uz*u+ux*.004));add(vent,materials.core,'annex-vent-'+i);
    }
  }
  // Both rear wings: the sea wing (edge 3) runs from its rear corner; the east wing (edge 1) is its mirror, run from the corner with the centre wall.
  for(const s of d.wings) {
    const f=frame(s.edge),[l0,l1]=s.landing,out=s.depth,inner=s.depth-s.wall,U=(v:number)=>s.mirror?f.length-v:v,name=(part:string)=>`annex-${s.name}-${part}`;
    const quad=(u0:number,u1:number,n0:number,n1:number)=>[f.at(U(u0),n0),f.at(U(u1),n0),f.at(U(u1),n1),f.at(U(u0),n1)];
    const face=(part:string,profile:number[][],n0:number,n1:number,material:THREE.MeshStandardMaterial)=>{
      const g=new THREE.ExtrudeGeometry(new THREE.Shape(profile.map(([x,y])=>new THREE.Vector2(U(x),y))),{depth:n1-n0,bevelEnabled:false,steps:1});g.translate(0,0,n0);g.applyMatrix4(f.matrix);add(g,material,name(part));
    };
    const foot=entranceDatum(context.ground,[sourcePoint(...f.at(U(s.bottom),inner/2))]);
    if(foot===null)throw Error('Annex wing stair needs land');
    prism(name('landing'),quad(l0,l1,0,inner),d.base,s.floor-.05);
    prism(name('landing-floor'),quad(l0,l1,0,inner),s.floor-.05,s.floor,materials.concrete);
    face('stair-wall',[[s.bottom,d.base],[l1,d.base],[l1,s.parapet],[s.slopeTop,s.parapet],[s.slopeTop,s.copingHigh],[s.flat,s.copingLow],[s.bottom,s.copingLow]],inner,out,materials.wall);
    prism(name('landing-end-wall'),quad(l1-s.wall,l1,0,inner),d.base,s.parapet);
    face('stair-coping',[[s.bottom-.04,s.copingLow],[s.flat,s.copingLow],[s.slopeTop,s.copingHigh],[s.slopeTop,s.copingHigh+.07],[s.flat,s.copingLow+.07],[s.bottom-.04,s.copingLow+.07]],inner-.03,out+.03,materials.concrete);
    prism(name('landing-coping'),[[s.slopeTop,out+.03],[l1+.03,out+.03],[l1+.03,0],[l1-s.wall-.03,0],[l1-s.wall-.03,inner-.03],[s.slopeTop,inner-.03]].map(([v,n])=>f.at(U(v),n)),s.parapet,s.parapet+.07,materials.concrete);
    const count=Math.max(1,Math.round((s.floor-foot)/.155)),rise=(s.floor-foot)/count,run=(l0-s.bottom)/count;
    for(let k=0;k<count;k++)prism(name('step-'+k),quad(s.bottom+k*run,s.bottom+(k+1)*run,0,inner),d.base,foot+(k+1)*rise,materials.concrete);
    for(const [i,[a,b,y]] of s.ledges.entries())prism(name('stair-ledge-'+i),quad(a,b,out,out+.14),y-.22,y+.22,materials.concrete);
    const c=s.canopy;
    prism(name('door-canopy'),quad(c.from,c.to,0,c.projection),c.bottom,c.top,materials.concrete);
    prism(name('door-canopy-flashing'),quad(c.from-.02,c.to+.02,0,c.projection+.02),c.top,c.top+.04,materials.roof);
    for(const [i,[a,b]] of c.corbels.entries())prism(name('door-corbel-'+i),quad(a,b,0,.6),c.corbelBottom,c.bottom+.01,materials.concrete);
    for(const [i,[a,b]] of c.piers.entries()) {
      prism(name('door-pier-'+i),quad(a,b,0,c.projection),c.top+.04,c.pierTop-.06);
      prism(name('door-pier-coping-'+i),quad(a-.03,b+.03,0,c.projection+.03),c.pierTop-.06,c.pierTop,materials.roof);
    }
  }
  for(const o of schedule.filter(o=>o.id.startsWith('annex-rear-small-door'))) {
    const f=frame(o.edge),h=d.smallDoorHood,hood=new THREE.BoxGeometry(o.width+2*h.over,h.thickness,h.projection);hood.translate(o.u,o.top+.03+h.thickness/2,h.projection/2);hood.applyMatrix4(f.matrix);add(hood,materials.concrete,o.id+'-hood');
  }
  const basement=d.basement,highGround=entranceDatum(context.ground,[sourcePoint(...basement.high)]);
  if(highGround===null)throw Error('Annex basement stairs need land');
  const half=basement.widthAtPlan/2,at=(t:number,side:number):Point2=>[basement.low[0]+(basement.high[0]-basement.low[0])*t+side*half,basement.low[1]+(basement.high[1]-basement.low[1])*t];
  const pit=[at(-.065,-1),at(-.065,1),at(1,1),at(1,-1)];
  prism('annex-basement-floor',pit,d.base,basement.floor,materials.concrete);
  const count=Math.max(1,Math.round((highGround-basement.floor)/.16));
  for(let i=0;i<count;i++) {
    const a=.2+.8*i/count,b=.2+.8*(i+1)/count;
    prism('annex-basement-step-'+i,[at(a,-1),at(a,1),at(b,1),at(b,-1)],d.base,basement.floor+(i+1)*(highGround-basement.floor)/count,materials.concrete);
  }
  const platformEnd=(basement.platformFront-basement.low[1])/(basement.high[1]-basement.low[1]);
  const platformTop=datum-tower.lift+tower.basementStairs.wallTop[0],wallTop=platformTop-basement.coping;
  const copings:Point2[][]=[];
  function coping(name:string,outline:Point2[],low:number) {
    let pieces:Point2[][]=[outline];
    for(const cutter of copings) {
      const sign=Math.sign(cutter.reduce((sum,a,i)=>{const b=cutter[(i+1)%cutter.length];return sum+a[0]*b[1]-b[0]*a[1];},0)),outside:Point2[][]=[];
      for(const piece of pieces) {
        let inside:number[][]=piece;
        for(let i=0;i<cutter.length&&inside.length>=3;i++) {
          const a=cutter[i],b=cutter[(i+1)%cutter.length],[keep,drop]=splitPolygon(inside,p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])));
          if(drop.length>=3)outside.push(drop as Point2[]);inside=keep;
        }
      }
      pieces=outside;
    }
    for(const piece of pieces)prism(name,piece,low,platformTop,materials.concrete);
    copings.push(outline);
  }
  for(const side of [-1,1]) {
    // The broad platform owns the inner retaining face and coping up to its front edge.
    const a=at(side===1?platformEnd:0,side),b=at(1,side),outline=[a,b,[b[0]+side*.22,b[1]],[a[0]+side*.22,a[1]]] as Point2[];
    prism('annex-basement-retaining-wall-'+side,outline,d.base,wallTop,materials.base);
    coping('annex-basement-wall-cap-'+side,outline,wallTop);
  }
  const platform:Point2[]=[at(0,1),[basement.platformRight,basement.low[1]],[basement.platformRight,basement.platformFront],at(platformEnd,1)];
  prism('annex-courtyard-platform-retaining-body',platform,d.base,wallTop,materials.base);
  prism('annex-courtyard-platform-paving',platform,wallTop,platformTop-.04,materials.base);
  const copingOuter=inset(platform,-.06),copingInner=inset(platform,.28);
  coping('annex-courtyard-platform-front-coping',[copingOuter[2],copingOuter[3],copingInner[3],copingInner[2]],platformTop-.13);
  coping('annex-courtyard-platform-side-coping',[copingOuter[3],copingOuter[0],copingInner[0],copingInner[3]],platformTop-.13);
  const offsetCorner=(i:number,depth:number):Point2=>{
    const a=ring[(i+ring.length-1)%ring.length],p=ring[i],b=ring[(i+1)%ring.length],la=Math.hypot(p[0]-a[0],p[1]-a[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const na=[-(p[1]-a[1])/la,(p[0]-a[0])/la],nb=[-(b[1]-p[1])/lb,(b[0]-p[0])/lb],scale=depth/(1+na[0]*nb[0]+na[1]*nb[1]);
    return [p[0]+(na[0]+nb[0])*scale,p[1]+(na[1]+nb[1])*scale];
  };
  for(const edge of [10,11]) {
    const f=frame(edge),shape=new THREE.Shape([[0,d.base],[f.length,d.base],[f.length,platformTop],[0,platformTop]].map(([x,y])=>new THREE.Vector2(x,y)));
    for(const o of schedule.filter(o=>o.edge===edge&&o.top<platformTop))shape.holes.push(new THREE.Path(path(o).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    const skin=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false,steps:1});skin.applyMatrix4(f.matrix);add(skin,materials.base,'annex-courtyard-plinth-'+edge);
    if(masonry) {
      const upper=new THREE.Shape([[0,platformTop-.95],[f.length,platformTop-.95],[f.length,platformTop],[0,platformTop]].map(([x,y])=>new THREE.Vector2(x,y)));
      const brickSkin=new THREE.ExtrudeGeometry(upper,{depth:.065,bevelEnabled:false,steps:1});brickSkin.applyMatrix4(f.matrix);add(brickSkin,masonry,'annex-courtyard-plinth-brick-'+edge);
    }
    prism('annex-courtyard-concrete-belt-'+edge,[ring[edge],ring[(edge+1)%ring.length],offsetCorner((edge+1)%ring.length,.22),offsetCorner(edge,.22)],platformTop,platformTop+.14,materials.concrete);
  }
  const pipeCorner=(i:number)=>offsetCorner(i,.18);
  const pipeLevel=1.25-tower.lift,first=pipeCorner(8),pipeGround=entranceDatum(context.ground,[sourcePoint(...first)]);
  if(pipeGround===null)throw Error('Annex pipe drop needs survey land');
  const points=[[first[0],Y(pipeGround-.08),first[1]],...[8,9,10,11].map(i=>{const [x,z]=pipeCorner(i);return [x,pipeLevel,z];}),[-tower.halfWidth-.18,pipeLevel,ring[11][1]+.18],[-tower.halfWidth-.18,pipeLevel,tower.sideFront+.12],[-tower.halfWidth,pipeLevel,tower.sideFront+.12]];
  add(roundedPipe(points),materials.pipe,'annex-yellow-pipe');
  batchDetailStudy(root);root.name='annex-plain-shape';root.userData.audit={outline:ring,schedule,datum,heights:d,basementPit:pit,platform:{ring:platform,top:platformTop},provisional:['Plan fit to tower and aerial','Upper volume profile and roof joints','Opening positions and absolute levels','Raised entrances and basement stair dimensions'],basis:'Owner photographs and simplified source plan; no generic survey window rows reused'};
  let disposed=false;
  return {root,ready,groundCuts:[pit.map(([x,z])=>sourcePoint(x,z))],setTextures(enabled:boolean){[materials.roof.map,materials.roof.bumpMap]=enabled?feltMaps:[null,null];materials.roof.needsUpdate=true;materials.concrete.map=materials.concrete.bumpMap=enabled?concreteMap:null;materials.concrete.needsUpdate=true;[materials.paleBrick.map,materials.paleBrick.bumpMap]=enabled?pale.maps:[null,null];materials.paleBrick.needsUpdate=true;},dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});concreteMap?.dispose();pale.release();Object.values(materials).forEach(m=>m.dispose());root.removeFromParent();}};
}
