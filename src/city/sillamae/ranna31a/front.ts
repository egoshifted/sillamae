import * as THREE from 'three';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {frontDesign as d, frontSchedule, sourcePoint, type FrontOpening} from './front-design.ts';
import {createFrontApron} from './apron.ts';
import {rearDesign as r, rearSchedule} from './rear-design.ts';
import {sideDesign, sideSchedule, type SideOpening} from './side-design.ts';
import {applyBrick,brickSurface} from './brick.ts';
import {addFrontServices} from './services.ts';
import {surfaces} from '../kesk1/surfaces.ts';

export function createFrontStudy(context: OverrideContext): StudyModel {
  const schedule = frontSchedule(), root = new THREE.Group();
  const brick=brickSurface();
  const materials = {
    wall: new THREE.MeshStandardMaterial({name: 'plain-shell', color: '#c4c1b8', roughness: 1}),
    panel: new THREE.MeshStandardMaterial({name: 'plain-balcony-panel', color: '#b0b3ae', roughness: 1}),
    frame: new THREE.MeshStandardMaterial({name: 'plain-frame', color: '#d5d8d2', roughness: 1}),
    glass: new THREE.MeshStandardMaterial({name: 'plain-infill', color: '#7b8b90', roughness: .9}),
    door: new THREE.MeshStandardMaterial({name: 'plain-door', color: '#626b69', roughness: 1}),
    brick: brick.material,
    entryDoor: new THREE.MeshStandardMaterial({name:'plain-door',color:'#292724',roughness:.85}),
    hardware: new THREE.MeshStandardMaterial({name:'entry-hardware',color:'#b5b7b2',roughness:.45,metalness:.65}),
    entrancePaint: new THREE.MeshStandardMaterial({name:'entrance-terracotta',color:'#b88165',roughness:1}),
    roofMetal: new THREE.MeshStandardMaterial({name:'roof-sheet-metal',color:'#a6aeac',roughness:.55,metalness:.35}),
    // Owner request: the weathered dark felt already used on Kesk 1 and Kesk 9; the shared maps are never disposed here.
    roof: new THREE.MeshStandardMaterial({name:'roof-felt',color:'#7f827e',roughness:1,bumpScale:.028}),
  };
  const felt=surfaces(),feltMaps=[felt.maps['felt-colour-v1'][0],felt.maps['felt-relief-v1'][0]] as const;
  [materials.roof.map,materials.roof.bumpMap]=feltMaps;
  const entrance = sourcePoint(d.entranceX, d.centreFront+1.8);
  const ground = entranceDatum(context.ground, [entrance]);
  if (ground===null) throw Error('Ranna 31a front study needs ground at its entrance');
  const datum = ground+d.lift;
  // Ground-set features (entrance, plinth, apron) are measured from the entrance ground, below the lifted datum.
  const g = -d.lift, entranceTop = d.entranceLevel+g;
  const contactPoints = [-d.halfWidth, -6.65, 0, 6.65, d.halfWidth].flatMap(x=>[d.back, d.sideFront, d.balconyFront].map(z=>sourcePoint(x,z)));
  const contactHeights = contactPoints.flatMap(p=>{const h=entranceDatum(context.ground,[p]); return h===null?[]:[h];});
  // Basement stair heights are set from the entrance ground, so lifting the building leaves them in the ground.
  const stairs = {...d.basementStairs, floor: d.basementStairs.floor-d.lift, top: d.basementStairs.top-d.lift, wallTop: d.basementStairs.wallTop.map(v=>v-d.lift) as [number, number]};
  // The foundation also reaches below the basement stair landings.
  const bottom = Math.min(Math.min(0,...contactHeights.map(h=>h-datum))-.4, stairs.floor-.3);
  // Plan area each basement stair takes from the apron, from the facade: owner correction, the gap behind the inner wall is left open, not paved.
  const stairCut = (run: typeof stairs.runs[number]) => {
    const start=run.high-Math.sign(run.low-run.high)*stairs.outerExtra, z0=d.sideFront, z1=d.sideFront+stairs.inner+stairs.width+stairs.wall;
    const [x0,x1]=[Math.min(start,run.low),Math.max(start,run.low)];
    return [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  };
  // The basement door sits in the balcony cheek's side at the foot of the stair, in (z, y) of the cheek profile.
  const stairDoor = {z0: d.sideFront+stairs.inner+(stairs.width-stairs.doorWidth)/2, z1: d.sideFront+stairs.inner+(stairs.width+stairs.doorWidth)/2, y0: stairs.floor, y1: stairs.floor+stairs.doorHeight};
  function add(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, name: string) {
    const mesh = new THREE.Mesh(geometry,material); mesh.name=name; mesh.castShadow=mesh.receiveShadow=true; root.add(mesh); return mesh;
  }
  function box(name: string, x: number, y: number, z: number, w: number, h: number, depth: number, material=materials.wall) {
    return add(new THREE.BoxGeometry(w,h,depth),material,name).position.set(x,y,z);
  }
  function planPrism(name: string, ring: number[][], low: number, high: number, material=materials.panel) {
    const shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:high-low,bevelEnabled:false,steps:1});
    geometry.rotateX(-Math.PI/2); geometry.translate(0,low,0);
    // Extrusion UVs are in metres; the felt tile reads at about 6 m.
    if(material===materials.roof){const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/6,uv.getY(i)/6);}
    add(geometry,material,name);
  }
  function openingPath(o: FrontOpening) {
    const a=o.x-o.width/2, b=o.x+o.width/2;
    if (o.kind!=='arch') return [[a,o.bottom],[b,o.bottom],[b,o.top],[a,o.top]];
    const radius=o.width/2, spring=o.top-radius;
    return [[a,o.bottom],[b,o.bottom],...Array.from({length:17},(_,i)=>{const angle=i*Math.PI/16;return [o.x+radius*Math.cos(angle),spring+radius*Math.sin(angle)];})];
  }
  function extrude(name: string, outline: number[][], holes: FrontOpening[], front: number, thickness: number, material=materials.wall, openEnds:boolean|number=false) {
    const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
    for (const o of holes) shape.holes.push(new THREE.Path(openingPath(o).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1}); geometry.translate(0,0,front-thickness);
    if(!openEnds) {add(geometry,material,name);return;}
    const source=geometry.index?geometry.toNonIndexed():geometry, p=source.getAttribute('position'), n=source.getAttribute('normal'), uv=source.getAttribute('uv');
    const values={position:[] as number[],normal:[] as number[],uv:[] as number[]}, ends=[Math.min(...outline.map(p=>p[0])),Math.max(...outline.map(p=>p[0]))];
    for(let i=0;i<p.count;i+=3) {
      let polygon=[0,1,2].map(k=>{const j=i+k;return [p.getX(j),p.getY(j),p.getZ(j),n.getX(j),n.getY(j),n.getZ(j),uv.getX(j),uv.getY(j)];});
      if(Math.abs(n.getX(i))>.99&&ends.some(x=>polygon.every(v=>Math.abs(v[0]-x)<1e-5))) {
        if(openEnds===true)continue;
        const limit=Number(openEnds), clipped:number[][]=[];
        for(let j=0;j<polygon.length;j++) {
          const a=polygon[j],b=polygon[(j+1)%polygon.length],inside=a[1]<=limit,next=b[1]<=limit;
          if(inside)clipped.push(a);
          if(inside!==next){const t=(limit-a[1])/(b[1]-a[1]);clipped.push(a.map((v,k)=>v+(b[k]-v)*t));}
        }
        polygon=clipped;
      }
      for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){values.position.push(...v.slice(0,3));values.normal.push(...v.slice(3,6));values.uv.push(...v.slice(6,8));}
    }
    const joined=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv'] as const)joined.setAttribute(name,new THREE.Float32BufferAttribute(values[name],name==='uv'?2:3));
    source.dispose();if(source!==geometry)geometry.dispose(); add(joined,material,name);
  }
  function wall(name: string, x0: number, x1: number, low: number, high: number, z: number, openings: FrontOpening[]=[], material=materials.wall) {
    extrude(name,[[x0,low],[x1,low],[x1,high],[x0,high]],openings,z,d.wall,material);
  }
  // A wall whose exterior faces the rear: built mirrored in x and turned half a revolution, so outline and openings stay in local x.
  function rearWall(name: string, outline: number[][], holes: FrontOpening[], outer: number, thickness: number, material=materials.wall) {
    const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(-x,y)));
    for (const o of holes) shape.holes.push(new THREE.Path(openingPath({...o,x:-o.x}).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
    geometry.translate(0,0,-outer-thickness); geometry.rotateY(Math.PI); add(geometry,material,name);
  }
  // An end wall facing side*x: the shape is drawn along local z (reversed on the east so it reads outward) and turned a quarter revolution.
  function endWall(name: string, side: number, z0: number, z1: number, low: number, high: number, holes: SideOpening[], outer: number, thickness: number) {
    const u=(z:number)=>side>0?-z:z;
    const shape=new THREE.Shape([[u(z0),low],[u(z1),low],[u(z1),high],[u(z0),high]].map(([x,y])=>new THREE.Vector2(x,y)));
    for (const o of holes) shape.holes.push(new THREE.Path(openingPath({...o,x:u(o.x)}).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
    geometry.rotateY(side*Math.PI/2); geometry.translate(outer-side*thickness,0,0); add(geometry,materials.wall,name);
  }
  function endInfill(o: SideOpening, outer: number) {
    const s=o.side, w=o.width, h=o.top-o.bottom, y=(o.bottom+o.top)/2, x=outer-s*.19;
    box(o.id+'-back',x,y,o.x,.035,h,w,materials.glass);
    if (o.kind==='vent') return;
    for (const z of [o.x-w/2+.035,o.x+w/2-.035]) box(o.id+'-jamb',x+s*.035,y,z,.08,h,.07,materials.frame);
    for (const yy of [o.bottom+.035,o.top-.035]) box(o.id+'-rail',x+s*.035,yy,o.x,.08,.07,w-.14,materials.frame);
    box(o.id+'-bar',x+s*.035,y,o.x,.07,h-.14,.045,materials.frame);
    box(o.id+'-sill',outer-s*.015,o.bottom-.04,o.x,.22,.08,w+.18,materials.panel);
  }
  // A wall between xa and xb whose top falls linearly from topA to topB, spanning z0..z1.
  function slopingWall(name: string, xa: number, xb: number, topA: number, topB: number, base: number, z0: number, z1: number, material=materials.wall) {
    const [left,right,topLeft,topRight]=xa<xb?[xa,xb,topA,topB]:[xb,xa,topB,topA];
    const shape=new THREE.Shape([[left,base],[right,base],[right,topRight-.08],[left,topLeft-.08]].map(([x,y])=>new THREE.Vector2(x,y)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:z1-z0,bevelEnabled:false,steps:1}); geometry.translate(0,0,z0); add(geometry,material,name);
    const cap=new THREE.Shape([[left,topLeft-.08],[right,topRight-.08],[right,topRight],[left,topLeft]].map(([x,y])=>new THREE.Vector2(x,y)));
    const coping=new THREE.ExtrudeGeometry(cap,{depth:z1-z0,bevelEnabled:false,steps:1});coping.translate(0,0,z0);add(coping,materials.panel,name+'-grey-cap');
  }
  // Basement stair along the front of an outer wing: paved gap, inner wall, channel, outer wall, steps down to a landing at the door.
  function basementStair(run: typeof stairs.runs[number]) {
    const s=stairs, dir=Math.sign(run.low-run.high), runEnd=run.low-dir*s.landing, base=s.floor-.3, name='basement-stair-'+(run.side<0?'left':'right');
    const z0=d.sideFront, c0=z0+s.inner, c1=c0+s.width, outer=c1+s.wall, start=run.high-dir*s.outerExtra;
    const top=(x:number)=>s.wallTop[0]+(s.wallTop[1]-s.wallTop[0])*(x-run.high)/(run.low-run.high);
    slopingWall(name+'-inner-wall',run.high,run.low,top(run.high),top(run.low),base,z0+s.gap,c0,materials.entrancePaint);
    slopingWall(name+'-outer-wall',start,run.low,top(run.high),top(run.low),base,c1,outer,materials.entrancePaint);
    // Owner photos: a grey concrete coping follows each plastered wall top, slightly wider than the wall.
    for (const [label,a,za,zb] of [['inner',run.high,z0+s.gap,c0],['outer',start,c1,outer]] as const) {
      const [left,right,topLeft,topRight]=a<run.low?[a,run.low,top(a),top(run.low)]:[run.low,a,top(run.low),top(a)];
      const shape=new THREE.Shape([[left,topLeft],[right,topRight],[right,topRight+.07],[left,topLeft+.07]].map(([x,y])=>new THREE.Vector2(x,y)));
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:zb-za+.08,bevelEnabled:false,steps:1}); geometry.translate(0,0,za-.04); add(geometry,materials.panel,name+'-'+label+'-coping');
    }
    // Owner correction: the high end stays open as the way in; both walls and the landing end at the balcony cheek, which holds the door.
    box(name+'-door',run.low+dir*.19,(stairDoor.y0+stairDoor.y1)/2,(stairDoor.z0+stairDoor.z1)/2,.035,stairDoor.y1-stairDoor.y0,stairDoor.z1-stairDoor.z0,materials.door);
    const risers=Math.round((s.top-s.floor)/.16), rise=(s.top-s.floor)/risers, tread=(runEnd-run.high)/risers;
    for (let k=0;k<risers;k++) {
      const y=s.top-(k+1)*rise, xa=run.high+k*tread;
      box(name+'-step',xa+tread/2,(base+y)/2,(c0+c1)/2,Math.abs(tread),y-base,s.width,materials.panel);
    }
    box(name+'-landing',(runEnd+run.low)/2,(base+s.floor)/2,(c0+c1)/2,Math.abs(run.low-runEnd),s.floor-base,s.width,materials.panel);
  }
  // A diamond lattice just proud of the wall: a perimeter frame and two families of diagonals clipped to the opening.
  function grille(o: FrontOpening, front: number) {
    const z=front+.03, x0=o.x-o.width/2, x1=o.x+o.width/2, y0=o.bottom, y1=o.top, bar=.025, step=.34;
    for (const y of [y0+bar/2,y1-bar/2]) box(o.id+'-grille-rail',o.x,y,z,o.width,bar,bar,materials.frame);
    for (const x of [x0+bar/2,x1-bar/2]) box(o.id+'-grille-stile',x,(y0+y1)/2,z,bar,y1-y0,bar,materials.frame);
    for (const slope of [1,-1]) for (let c=(slope>0?x0-y1:x0+y0)+step/2; c<(slope>0?x1-y0:x1+y1); c+=step) {
      // Along x = c + slope*y, the part of the line inside the opening.
      const ya=Math.max(y0,slope>0?x0-c:c-x1), yb=Math.min(y1,slope>0?x1-c:c-x0);
      if (yb-ya<.05) continue;
      const mesh=add(new THREE.BoxGeometry((yb-ya)*Math.SQRT2,bar,bar),materials.frame,o.id+'-grille-bar');
      mesh.position.set(c+slope*(ya+yb)/2,(ya+yb)/2,z); mesh.rotation.z=slope*Math.PI/4;
    }
  }
  // facing is +1 for the front and -1 for the rear; recesses and sills follow the exterior side.
  function infill(o: FrontOpening, front: number, facing=1) {
    const w=o.width, h=o.top-o.bottom, z=front-facing*.19;
    const frame=o.kind==='door'&&facing===1?materials.entryDoor:materials.frame;
    box(o.id+'-back',o.x,(o.bottom+o.top)/2,z,w,h,.035,o.kind==='door'?(facing===1?materials.entryDoor:materials.door):materials.glass);
    if (o.kind==='vent') return;
    for (const x of [o.x-w/2+.035,o.x+w/2-.035]) box(o.id+'-jamb',x,(o.bottom+o.top)/2,z+facing*.035,.07,h,.08,frame);
    for (const y of [o.bottom+.035,o.top-.035]) box(o.id+'-rail',o.x,y,z+facing*.035,w-.14,.07,.08,frame);
    if (o.kind==='window') for (const fraction of [-1/6,1/6]) box(o.id+'-bar',o.x+w*fraction,(o.bottom+o.top)/2,z+facing*.035,.045,h-.14,.07,materials.frame);
    if (o.kind==='window') box(o.id+'-sill',o.x,o.bottom-.04,front-facing*.015,w+.18,.08,.22,materials.panel);
  }
  // The 25 mm folded edge represents thin sheet roofing, not a concrete roof slab.
  function slopedSlab(name: string, x0: number, x1: number, zLow: number, yLow: number, zHigh: number, yHigh: number, material=materials.roofMetal) {
    const corners=[[x0,yHigh,zHigh],[x1,yHigh,zHigh],[x1,yLow,zLow],[x0,yLow,zLow],[x0,yHigh-.025,zHigh],[x1,yHigh-.025,zHigh],[x1,yLow-.025,zLow],[x0,yLow-.025,zLow]];
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(corners.flat(),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(corners.flatMap(([x,,z])=>[(x-x0)/(x1-x0),z]),2));
    geometry.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
    const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();add(flat,material,name);
    const direction=new THREE.Vector3(0,yHigh-yLow,zHigh-zLow),normal=new THREE.Vector3(0,1,-(yHigh-yLow)/(zHigh-zLow)).normalize(),length=direction.length();direction.normalize();
    for(let x=Math.min(x0,x1)+.45;x<Math.max(x0,x1)-.1;x+=.5) {
      const seam=add(new THREE.BoxGeometry(.012,.016,length),material,name+'-standing-seam');
      seam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      seam.position.set(x,(yHigh+yLow)/2,(zHigh+zLow)/2);seam.position.addScaledVector(normal,.008);
    }
  }
  for (const side of [-1,1]) {
    const x0=side<0?-d.halfWidth:6.65, x1=side<0?-6.65:d.halfWidth, group=side<0?'outer-left':'outer-right';
    const openings=schedule.filter(o=>o.group===group);
    wall(group,x0,x1,bottom,d.sideTop,d.sideFront,openings);
    for (const o of openings) { infill(o,d.sideFront); if (d.grilles.includes(o.id)) grille(o,d.sideFront); }
    basementStair(stairs.runs.find(run=>run.side===side)!);
    // The end wall runs between the rear cheek and the front wall, which own its two corners, so no faces coincide there.
    const outer=side*d.halfWidth, endOpenings=sideSchedule().filter(o=>o.side===side), [m0,m1]=sideDesign.middle;
    endWall(group+'-end',side,r.loggiaWall,d.sideFront-d.wall,bottom,d.sideTop,endOpenings,outer,d.wall);
    for (const o of endOpenings) endInfill(o,outer);
    box(group+'-end-middle',outer+side*sideDesign.projection/2,(bottom+d.sideTop)/2,(m0+m1)/2,sideDesign.projection,d.sideTop-bottom,m1-m0);
  }
  const centreOpenings=schedule.filter(o=>o.group==='centre');
  extrude('centre-front',[[-3.8,bottom],[3.8,bottom],[3.8,d.centreShoulder],[0,d.centrePeak],[-3.8,d.centreShoulder]],centreOpenings,d.centreFront,d.wall,materials.wall,d.firstHead+(d.floors-1)*d.pitch);
  for (const o of centreOpenings) {
    if (o.kind!=='arch') { infill(o,d.centreFront); continue; }
    const path=openingPath(o), backing=new THREE.Shape(path.map(([x,y])=>new THREE.Vector2(x,y)));
    const geometry=new THREE.ShapeGeometry(backing); geometry.translate(0,0,d.centreFront-.3); add(geometry,materials.wall,o.id+'-backing');
    const outer=[[o.x-o.width/2-.2,o.bottom-.1],[o.x+o.width/2+.2,o.bottom-.1],[o.x+o.width/2+.2,o.top+.18],[o.x-o.width/2-.2,o.top+.18]];
    extrude(o.id+'-surround',outer,[o],d.centreFront+.06,.06,materials.panel);
  }
  for (const [stack, x] of d.balconyCentres.entries()) {
    const a=x-d.balconyWidth/2, b=x+d.balconyWidth/2;
    wall('balcony-'+stack+'-backing',a,b,bottom,d.deck,d.centreFront-d.wall);
    box('balcony-'+stack+'-foundation',x,(bottom+.03+g)/2,d.balconyFront-d.wall/2,d.balconyWidth,.03+g-bottom,d.wall);
    for (const side of [-1,1]) box('balcony-'+stack+'-foundation-return',x+side*(d.balconyWidth/2-d.wall/2),(bottom+.03+g)/2,(d.centreFront+d.balconyFront-d.wall)/2,d.wall,.03+g-bottom,d.balconyFront-d.wall-d.centreFront);
    for (const [index, edge] of [a,b].entries()) {
      const outer=index===0?-1:1, thickness=index===stack?.45:d.wall, lowX=outer<0?edge-thickness:edge;
      const backTop=index===stack?d.centreShoulder:d.bladeTop;
      const base=index===stack?bottom:d.firstHead+(d.floors-1)*d.pitch;
      const cheekFront=index===stack?d.balconyFront+d.outerCheekProjection:d.balconyFront;
      const shape=new THREE.Shape([[d.sideFront,base],[cheekFront,base],[cheekFront,d.bladeTop],[d.sideFront,backTop]].map(([z,y])=>new THREE.Vector2(z,y)));
      // The outer cheek's side holds the basement door at the foot of the stair along the wing.
      if (index===stack) shape.holes.push(new THREE.Path([[stairDoor.z0,stairDoor.y0],[stairDoor.z0,stairDoor.y1],[stairDoor.z1,stairDoor.y1],[stairDoor.z1,stairDoor.y0]].map(([z,y])=>new THREE.Vector2(z,y))));
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
      geometry.rotateY(-Math.PI/2); geometry.translate(lowX+thickness,0,0); add(geometry,materials.wall,'balcony-'+stack+'-continuous-cheek-'+index);
    }
    for (const o of schedule.filter(o=>o.kind==='balcony'&&o.x===x)) {
      const level=o.floor!*d.pitch, back=d.centreFront-.12, front=d.balconyFront, depth=front-back;
      const panelBase=o.floor===0?1.08+g:level+.21;
      if(o.floor===0) {
        const low=bottom,high=.94+g,recess=.3;
        box(o.id+'-recessed-plinth-front',x,(low+high)/2,front-recess-.1,d.balconyWidth,high-low,.2,materials.wall);
        box(o.id+'-plinth-cap',x,1.01+g,(front+back)/2,d.balconyWidth,.14,depth,materials.panel);
        // The apron stops at the balcony face; the paving continues level into the recess under the cap.
        box(o.id+'-recess-floor',x,(low+entranceTop)/2,front-recess/2,d.balconyWidth,entranceTop-low,recess,materials.panel);
        // Owner photos: the outer wall stands on its own aggregate block, proud of the wall and reaching under the cap; sizes inferred.
        const outward=stack===0?-1:1, edge=stack===0?a:b, footFront=front+d.outerCheekProjection+.08;
        const footOuter=edge+outward*(.45+.06), footInner=edge-outward*.25;
        // The block starts behind the basement stair's outer wall, so it never stands in front of the door in the cheek.
        const footBack=Math.max(d.centreFront,d.sideFront+stairs.inner+stairs.width+stairs.wall);
        box(o.id+'-outer-footing',(footOuter+footInner)/2,(low+high)/2,(footBack+footFront)/2,Math.abs(footOuter-footInner),high-low,footFront-footBack,materials.panel);
        if(stack===1) box(o.id+'-inner-plinth-return',a+.08,(low+high)/2,(d.centreFront+front-recess)/2,.16,high-low,front-recess-d.centreFront,materials.panel);
        if(stack===0) {
          const innerSide=1,edge=x+d.balconyWidth/2,thick=.16,pierLow=low,pierHigh=o.top,pierBack=d.centreFront-d.wall,pierFront=d.balconyFront;
          const skin=.06,core=thick-skin,coreX=edge+innerSide*core/2,skinX=edge+innerSide*(core+skin/2);
          const holeLow=.42+g,holeHigh=.74+g,holeFront=pierFront-.16,holeBack=holeFront-.32;
          box(o.id+'-inner-pier',coreX,(pierLow+pierHigh)/2,(pierBack+pierFront)/2,core,pierHigh-pierLow,pierFront-pierBack);
          box(o.id+'-inner-pier-sill',skinX,(holeLow+pierLow)/2,(pierBack+pierFront)/2,skin,holeLow-pierLow,pierFront-pierBack);
          box(o.id+'-inner-pier-head',skinX,(holeHigh+pierHigh)/2,(pierBack+pierFront)/2,skin,pierHigh-holeHigh,pierFront-pierBack);
          box(o.id+'-inner-pier-front',skinX,(holeLow+holeHigh)/2,(holeFront+pierFront)/2,skin,holeHigh-holeLow,pierFront-holeFront);
          box(o.id+'-inner-pier-back',skinX,(holeLow+holeHigh)/2,(pierBack+holeBack)/2,skin,holeHigh-holeLow,holeBack-pierBack);
          box(o.id+'-basement-recess',edge+innerSide*(core-.02),(holeLow+holeHigh)/2,(holeBack+holeFront)/2,.04,holeHigh-holeLow,holeFront-holeBack,materials.door);
        }
      }
      // On the ground floor the plinth cap is the balcony floor; a slab at the lifted datum would cut across the plinth recess.
      if(o.floor!==0) box(o.id+'-slab',x,level+.12,(front+back)/2,d.balconyWidth,.18,depth,materials.panel);
      box(o.id+'-panel',x,(panelBase+o.bottom)/2,front-.08,d.balconyWidth,o.bottom-panelBase,.16,materials.panel);
      infill(o,front);
      for (const side of [-1,1]) {
        const start=back+.08, end=front-.195;
        box(o.id+'-side-panel',x+side*(d.balconyWidth/2-.065),(panelBase+o.bottom)/2,(back+front-.16)/2,.13,o.bottom-panelBase,depth-.16,materials.panel);
        box(o.id+'-side-glass',x+side*(d.balconyWidth/2-.09),(o.bottom+o.top)/2,(start+end)/2,.035,o.top-o.bottom,end-start,materials.glass);
        box(o.id+'-rear-post',x+side*(d.balconyWidth/2-.04),(o.bottom+o.top)/2,back+.06,.08,o.top-o.bottom,.075,materials.frame);
        for (const y of [o.bottom+.035,o.top-.035]) box(o.id+'-side-rail',x+side*(d.balconyWidth/2-.04),y,(start+end)/2,.08,.07,end-start,materials.frame);
      }
      for (const fraction of [-1/6,1/6]) box(o.id+'-pane-post',x+d.balconyWidth*fraction,(o.bottom+o.top)/2,front-.15,.05,o.top-o.bottom,.08,materials.frame);
    }
    // The cover rises to the raised roof deck and joins its front edge, so the roof runs on without a step.
    const roofFront=d.balconyFront+.05, roofBack=d.centreFront-d.wall, frontY=d.firstHead+(d.floors-1)*d.pitch+.13, backY=d.upperDeck;
    slopedSlab('balcony-'+stack+'-sloping-cover',a,b,roofFront,frontY,roofBack,backY);
    const head=d.firstHead+(d.floors-1)*d.pitch;
    const underside=(z:number)=>backY+(frontY-backY)*(z-roofBack)/(roofFront-roofBack)-.025;
    for(const [label,z0,z1,base] of [['front',d.balconyFront-.23,roofFront,head]] as const) {
      const shape=new THREE.Shape([[z0,base],[z1,base],[z1,underside(z1)],[z0,underside(z0)]].map(([z,y])=>new THREE.Vector2(z,y)));
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:d.balconyWidth,bevelEnabled:false,steps:1});
      geometry.rotateY(-Math.PI/2);geometry.translate(x+d.balconyWidth/2,0,0);add(geometry,materials.frame,'balcony-'+stack+'-roof-'+label+'-closure');
    }
  }
  const rearOpenings=rearSchedule(), e=r.entrance;
  for (const side of [-1,1]) {
    const [c0,c1]=r.cheek, [b0,b1]=r.band, [t0,t1]=r.tower, span=(u:number,v:number)=>side<0?[-v,-u]:[u,v];
    const [cx0,cx1]=span(c0,c1), [bx0,bx1]=span(b0,b1), [tx0,tx1]=span(t0,t1);
    // The outer cheek closes the recessed band at its full depth.
    rearWall('rear-cheek-'+side,[[cx0,bottom],[cx1,bottom],[cx1,d.sideTop],[cx0,d.sideTop]],[],r.face,r.loggiaWall-r.face);
    const ribbons=rearOpenings.filter(o=>o.kind==='balcony'&&Math.sign(o.x)===side);
    rearWall('rear-band-front-'+side,[[bx0,bottom],[bx1,bottom],[bx1,r.bandEave],[bx0,r.bandEave]],ribbons,r.bandFace,.2,materials.panel);
    for (const o of ribbons) {
      infill(o,r.bandFace,-1);
      const panes=Math.round(o.width/.88);
      for (let i=1;i<panes;i++) box(o.id+'-mullion',o.x-o.width/2+o.width*i/panes,(o.bottom+o.top)/2,r.bandFace+.155,.05,o.top-o.bottom,.08,materials.frame);
    }
    box('rear-loggia-wall-'+side,(bx0+bx1)/2,(bottom+d.deck-.18)/2,r.loggiaWall+d.wall/2,b1-b0,d.deck-.18-bottom,d.wall);
    // Owner photos: the band's sloping metal canopy runs from the band eave up to the wing roof, with no parapet above it.
    slopedSlab('rear-band-canopy-'+side,bx1,bx0,r.face,r.bandEave,r.loggiaWall,d.deck);
    // Under the rear canopy the tower's inner edge is cut back to the porch; the pier and the canopy own that corner, so no faces coincide.
    const cut=side*e.right, peak=[side*r.towerColumn,r.towerPeak];
    const outline=side>0?[[cut,bottom],[tx1,bottom],[tx1,r.towerShoulder],peak,[tx0,r.towerShoulder],[tx0,e.canopyTop],[cut,e.canopyTop]]:[[tx0,bottom],[cut,bottom],[cut,e.canopyTop],[tx1,e.canopyTop],[tx1,r.towerShoulder],peak,[tx0,r.towerShoulder]];
    const towerHoles=rearOpenings.filter(o=>Math.sign(o.x)===side&&o.group!=='centre'&&o.kind!=='balcony');
    rearWall('rear-tower-'+side,outline,towerHoles,r.face,d.wall);
    for (const o of towerHoles) {
      if (o.kind!=='arch') { infill(o,r.face,-1); continue; }
      const glass=new THREE.ShapeGeometry(new THREE.Shape(openingPath({...o,x:-o.x}).map(([x,y])=>new THREE.Vector2(x,y))));
      glass.rotateY(Math.PI); glass.translate(0,0,r.face+.19); add(glass,materials.glass,o.id+'-glass');
      const s=r.archSurround;
      rearWall(o.id+'-surround',[[o.x-s.bottomWidth/2,s.bottom],[o.x+s.bottomWidth/2,s.bottom],[o.x+s.topWidth/2,s.top],[o.x-s.topWidth/2,s.top]],[o],r.face-.06,.06,materials.panel);
    }
    // Returns: the tower's outer edge faces the recessed band, its inner edge the recessed stair centre.
    const outerEdge=side*r.tower[1]-side*d.wall/2, innerEdge=side*r.tower[0]+side*d.wall/2;
    box('rear-tower-band-return-'+side,outerEdge,(bottom+r.towerShoulder)/2,(r.face+r.loggiaWall)/2,d.wall,r.towerShoulder-bottom,r.loggiaWall-r.face);
    box('rear-tower-centre-return-'+side,innerEdge,(e.canopyTop+r.towerShoulder)/2,(r.face+r.centreFace+d.wall)/2,d.wall,r.towerShoulder-e.canopyTop,r.centreFace+d.wall-r.face);
    box('rear-entrance-pier-'+side,side*(e.porchEdge+e.right)/2,(bottom+e.canopyBottom)/2,(r.face+r.centreFace)/2,e.right-e.porchEdge,e.canopyBottom-bottom,r.centreFace-r.face);
  }
  const canopyFront=r.face-1.1;
  // The stair wall continues under the canopy as the porch back wall, so both doors share one plane.
  const centreHoles=rearOpenings.filter(o=>o.group==='centre'&&Math.abs(o.x)<e.porchEdge);
  const t=r.tower[0], pe=e.porchEdge;
  rearWall('rear-stair-centre',[[-pe,bottom],[pe,bottom],[pe,e.canopyBottom],[t,e.canopyBottom],[t,d.centreShoulder],[-t,d.centreShoulder],[-t,e.canopyBottom],[-pe,e.canopyBottom]],centreHoles,r.centreFace,d.wall);
  for (const o of centreHoles) infill(o,r.centreFace,-1);
  box('rear-entrance-canopy',(e.left+e.right)/2,(e.canopyBottom+e.canopyTop-.03)/2,(canopyFront+r.centreFace)/2,e.right-e.left,e.canopyTop-e.canopyBottom-.03,r.centreFace-canopyFront,materials.entrancePaint);
  box('rear-entrance-grey-cover',(e.left+e.right)/2,e.canopyTop-.015,(canopyFront+r.centreFace)/2,e.right-e.left+.06,.03,r.centreFace-canopyFront+.06,materials.panel);
  for (const x of [e.left+.15,e.right-.15]) box('rear-entrance-canopy-cheek',x,e.canopyBottom-.2,(canopyFront+r.face)/2,.3,.4,r.face-canopyFront,materials.entrancePaint);
  // Owner aerial: the raised roof runs forward to the balcony tops over both stacks, with no sunken terrace behind them; at the rear it steps back over the stair centre.
  const upper=[[-3.8,d.back],[-r.tower[0],d.back],[-r.tower[0],r.centreFace],[r.tower[0],r.centreFace],[r.tower[0],d.back],[3.8,d.back],[3.8,0],[6.65,0],[6.65,d.centreFront],[-6.65,d.centreFront],[-6.65,0],[-3.8,0]];
  const inner=upper.map((p,i)=>{
    const a=upper[(i+upper.length-1)%upper.length], b=upper[(i+1)%upper.length];
    const before=Math.hypot(p[0]-a[0],p[1]-a[1]), after=Math.hypot(b[0]-p[0],b[1]-p[1]);
    return [p[0]-d.wall*((p[1]-a[1])/before+(b[1]-p[1])/after),p[1]+d.wall*((p[0]-a[0])/before+(b[0]-p[0])/after)];
  });
  for(let i=0;i<upper.length;i++) {
    const j=(i+1)%upper.length;
    // The existing front gable owns the middle of the front band, including its exterior face.
    // Over the balconies the roof meets the sloping covers with no parapet, per the owner's higher aerial.
    if(upper[i][1]===d.centreFront&&upper[j][1]===d.centreFront)continue;
    // The rear towers and stair centre own the back of the raised roof.
    if(Math.max(upper[i][1],upper[j][1])<=r.centreFace)continue;
    planPrism('upper-roof-wall-'+i,[upper[i],upper[j],inner[j],inner[i]],d.deck,d.centreShoulder,materials.wall);
  }
  planPrism('raised-central-roof',inner,d.upperDeck-.18,d.upperDeck,materials.roof);
  for(const side of [-1,1]) {
    // Behind the bands the wing roof starts where their canopies end; behind the towers it reaches their walls.
    const lower=[[-d.halfWidth+d.wall,r.loggiaWall],[-r.band[0],r.loggiaWall],[-r.band[0],d.back+d.wall],[-3.8,d.back+d.wall],[-3.8,0],[-6.65,0],[-6.65,d.sideFront-d.wall],[-d.halfWidth+d.wall,d.sideFront-d.wall]].map(([x,z])=>[side*x,z]);
    planPrism('lower-wing-roof-'+side,lower,d.deck-.18,d.deck,materials.roof);
  }
  for(const fixture of d.roofFixtures) {
    const base=fixture.upper?d.upperDeck:d.deck;
    box(fixture.id,fixture.x,base+fixture.height/2,fixture.z,fixture.width,fixture.height,fixture.depth,materials.panel);
    const caps=fixture.upper?3:1, length=fixture.depth/caps;
    for(let i=0;i<caps;i++)box(fixture.id+'-cap-'+i,fixture.x,base+fixture.height+.045,fixture.z-fixture.depth/2+length*(i+.5),fixture.width+.12,.09,length-.04,materials.wall);
  }
  box('entrance-canopy',d.entranceX,2.92+g,d.centreFront+.65,3.6,.18,1.4,materials.entrancePaint);
  box('entrance-canopy-top-cover',d.entranceX,3.025+g,d.centreFront+.65,3.66,.03,1.46,materials.panel);
  box('entrance-canopy-concrete-lintel',d.entranceX,2.79+g,d.centreFront+1.28,3.0,.08,.14,materials.panel);
  for (const side of [-1,1]) box('entrance-canopy-cheek',d.entranceX+side*1.65,2.45+g,d.centreFront+.6,.3,.76,1.3,materials.entrancePaint);
  // Owner photos: aggregate base just proud of the entrance wall, its cap level with the balcony plinth caps.
  const door=schedule.find(o=>o.kind==='door')!, baseRuns=[[-3.64,door.x-door.width/2],[door.x+door.width/2,3.8]];
  const doorLeft=door.x-door.width/2, seam=doorLeft+door.width*.31, face=d.centreFront-.145;
  box('entry-leaf-seam',seam,(door.bottom+door.top)/2,face,.018,door.top-door.bottom-.08,.02,materials.door);
  for(const [left,right] of [[doorLeft+.04,seam-.015],[seam+.015,doorLeft+door.width-.04]])
    box('entry-kickplate',(left+right)/2,door.bottom+.15,face+.015,right-left,.24,.025,materials.hardware);
  const knob=new THREE.SphereGeometry(.044,16,10);
  add(knob,materials.hardware,'entry-round-handle').position.set(seam+.12,door.bottom+1.02,face+.055);
  box('entry-handle-mount',seam+.12,door.bottom+1.02,face+.018,.09,.09,.025,materials.hardware);
  const intercomX=doorLeft+door.width*.20, intercomY=door.bottom+1.52;
  box('entry-intercom',intercomX,intercomY,face+.023,.10,.23,.045,materials.door);
  box('entry-intercom-display',intercomX,intercomY+.062,face+.049,.065,.035,.008,materials.glass);
  for(let row=0;row<4;row++)for(let column=0;column<3;column++)
    box('entry-intercom-button',intercomX+(column-1)*.022,intercomY-.012-row*.023,face+.051,.014,.014,.009,materials.hardware);
  for(const [x0,x1] of baseRuns) {
    box('entrance-wall-base',(x0+x1)/2,(bottom+.95+g)/2,d.centreFront-.015,x1-x0,.95+g-bottom,.07,materials.wall);
    box('entrance-wall-base-cap',(x0+x1)/2,1.015+g,d.centreFront-.01,x1-x0,.13,.12,materials.panel);
  }
  const street=entranceDatum(context.ground,[sourcePoint(d.entranceX,d.centreFront+3.5)]);
  if(street===null)throw Error('Ranna 31a entrance steps need land at the approach');
  const streetLevel=street-datum, landingTop=entranceTop, treadTop=(streetLevel+landingTop)/2;
  if(treadTop<=streetLevel||landingTop<=treadTop)throw Error('Entrance landing must stand above its approach');
  const entryBase=Math.min(bottom,streetLevel-.15);
  const landing=[[-1.8,-d.wall],[1.8,-d.wall],[1.8,1.65],[2.5,2.5],[-2.5,2.5],[-1.8,1.65]].map(([x,z])=>[d.entranceX+x,d.centreFront+z]);
  const tread=[[-2.5,2.5],[2.5,2.5],[3.2,3.45],[-3.2,3.45]].map(([x,z])=>[d.entranceX+x,d.centreFront+z]);
  planPrism('entrance-landing',landing,entryBase,landingTop,materials.panel);
  planPrism('entrance-low-step',tread,entryBase,treadTop,materials.panel);
  const apron=createFrontApron(context.ground,datum,[landing,...stairs.runs.map(stairCut)],entranceTop);
  add(apron.geometry,materials.panel,'front-apron');
  for(const side of [-1,1]) {
    const points=[[d.entranceX+side*2.5,landingTop+.025,d.centreFront+2.5],[d.entranceX+side*2.62,landingTop+.025,d.centreFront+2.5],[d.entranceX+side*3.32,streetLevel+.035,d.centreFront+3.45],[d.entranceX+side*3.2,streetLevel+.035,d.centreFront+3.45]];
    const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[2]-b[0]*a[2];},0);if(area<0)points.reverse();
    const vertices=[...points,...points.map(([x,,z])=>[x,entryBase,z])], geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap(([x,,z])=>[x,z]),2));
    geometry.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
    const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();add(flat,materials.panel,'entrance-sloping-edge-'+side);
  }
  applyBrick(root,brick.material);
  const services=addFrontServices(root);
  root.position.set(d.centre[0]-context.frame.origin[0],datum-context.frame.base,d.centre[1]-context.frame.origin[1]); root.rotation.y=d.angle;
  batchDetailStudy(root);
  root.name='ranna31a-front-plain';
  root.userData.audit={basis:d.basis,datum,bottom,contactHeights,schedule,entrance:{landing,tread,streetLevel,treadTop,landingTop,entryBase,basis:'Owner marked entrance photo: flared low approach, two rises and sloping side edges; dimensions inferred'},roof:{upper,inner,lowerDeck:d.deck,upperDeck:d.upperDeck,parapet:d.centreShoulder,fixtures:d.roofFixtures,basis:'Owner aerial: stepped roof, three roof blocks and two rear crowns; fixture dimensions and rear round details inferred'},rear:{schedule:rearOpenings,basis:r.basis},scope:'Front and rear elevations, entrances and roof massing; side facades are unstudied context, low wing excluded',provisional:['Dimensions and plan fit','Individual glazing replacements and bars','Roof fixture dimensions and rear crown placement','Foundation and entrance contact in atlas']};
  let disposed=false;
  // Owner request: open the diagnostic ground over each stair pit, from the first step to the cheek and from the paved gap to the outer wall face.
  const groundCuts=stairs.runs.map(run=>{
    const [x0,x1]=[Math.min(run.high,run.low),Math.max(run.high,run.low)], z0=d.sideFront+stairs.gap, z1=d.sideFront+stairs.inner+stairs.width+stairs.wall;
    return [[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>sourcePoint(x,z));
  });
  const keepGroundTriangle=(triangle:OverrideContext['ground'][number])=>!([0,3,6].every(i=>{
    const x=triangle[i]-d.centre[0],z=triangle[i+1]-d.centre[1],localX=Math.cos(d.angle)*x-Math.sin(d.angle)*z,localZ=Math.sin(d.angle)*x+Math.cos(d.angle)*z;
    return localX>.7&&localX<1.45&&localZ>-13.55&&localZ<-13.15;
  }));
  return {root,groundCuts,keepGroundTriangle,ready:Promise.all([brick.ready,felt.ready]).then(()=>{}),setTextures(enabled:boolean){brick.setTextures(enabled);[materials.roof.map,materials.roof.bumpMap]=enabled?feltMaps:[null,null];materials.roof.needsUpdate=true;},dispose(){if(disposed)return;disposed=true;brick.dispose();services.dispose();root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});Object.values(materials).forEach(m=>m.dispose());root.removeFromParent();}};
}
