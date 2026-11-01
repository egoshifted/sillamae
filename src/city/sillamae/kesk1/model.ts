import * as THREE from 'three';
import {surfaces} from './surfaces.ts';
import type {Building, GroundTriangle, Point2, Polygon, TerrainGrid, WorldFrame} from '../../../engine/types.ts';
import type {kesk1Design} from './index.ts';

export function addSteppedApartment(scene: THREE.Scene, building: Building, terrain: TerrainGrid & {siteGround?: GroundTriangle[]}, design: typeof kesk1Design & {closedConstructionAudit?: boolean; rearAccessDraft?: boolean}, frame: WorldFrame) {
  const [ox,oz]=frame.origin,level=design.foundationLevel;
  const surface=surfaces(),sharedTextures=new Set(Object.values(surface.maps).flat());
  const root=new THREE.Group() as THREE.Group & {children: THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]; userData: {groundPatches?: Polygon[]; setTextures(enabled: boolean): void; ready: Promise<void[]>; dispose(): void; [key: string]: unknown}};root.position.set(0,level-frame.base,0);scene.add(root);
  const batches=new Map<THREE.MeshStandardMaterial,THREE.BufferGeometry[]>(),g=building.g,pendingCaps: {material: THREE.MeshStandardMaterial; points: THREE.Vector3[]}[]=[];
  const closedConstructionAudit=design.closedConstructionAudit===true;
  const mat=(color: THREE.ColorRepresentation,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness,shadowSide:THREE.DoubleSide});
  const brick=mat('#c18460'),concrete=mat('#95958e'),trim=mat('#dddcd4'),glass=mat('#65818a',.3),dark=mat('#323b3b'),wood=mat('#6c4933'),metal=mat('#575c59'),roof=mat('#464b48'),redWood=mat('#834c38'),green=mat('#4d6938'),flower=mat('#eee9ca');
  const foundation=mat('#aaa99f',1);foundation.userData.foundationRender=true;foundation.vertexColors=true;
  let foundationStain: ((x: number,y: number,z: number)=>number) | null=null;
  [foundation.map,foundation.bumpMap]=surface.maps['roughcast-v1'];foundation.bumpScale=.065;
  const sillMetal=mat('#818b8d',.45);sillMetal.metalness=.55;sillMetal.userData.sheetMetal=true;
  const paleMetal=mat('#bcc2c0',.5);paleMetal.metalness=.1;paleMetal.userData.sheetMetal=true;
  const roofEdgeMetal=mat('#a6aeac',.94);roofEdgeMetal.metalness=.08;roofEdgeMetal.userData.sheetMetal=true;roofEdgeMetal.userData.roofEdgeMetal=true;
  const lintelMaterial=mat('#a8aaa3');
  const membraneMaterials=new Set([roof]),tire=mat('#464b48');
  brick.color.set('#c8a58a');brick.roughness=1;brick.metalness=0;
  const felt=surface.maps['felt-colour-v1'][0],feltHeight=surface.maps['felt-relief-v1'][0];roof.color.set('#7f827e');roof.roughness=1;roof.metalness=0;roof.map=felt;roof.bumpMap=feltHeight;roof.bumpScale=.028;roof.userData.roofMembrane=true;
  const canopyMembrane=roof.clone();canopyMembrane.map=surface.maps['canopy-felt-v1'][0];canopyMembrane.bumpScale=.003;canopyMembrane.userData.localUV=true;membraneMaterials.add(canopyMembrane);
  [brick.map,brick.bumpMap]=surface.maps['masonry-v1'];brick.bumpScale=.016;concrete.map=surface.maps['concrete-v1'][0];concrete.bumpMap=concrete.map;concrete.bumpScale=.025;
  const stepConcrete=concrete.clone(),groundConcrete=concrete.clone(),apronConcrete=concrete.clone();groundConcrete.userData.groundSurface=apronConcrete.userData.groundSurface=true;
  // Site survey vertices keep layer 0; a 1 m apron bias draws it through the foundation.
  function lift(material: THREE.MeshStandardMaterial,bias=1){material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * '+(bias===1?'1.':bias)+';');};material.customProgramCacheKey=()=>'kesk1-ground-lift-'+bias;return material;}
  lift(stepConcrete);lift(groundConcrete);lift(apronConcrete,.01);
  function emit(geo: THREE.BufferGeometry,m: THREE.MeshStandardMaterial,matrix: THREE.Matrix4){geo=geo.index?geo.toNonIndexed():geo.clone();geo.applyMatrix4(matrix);if(m===foundation){const p=geo.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const v=foundationStain?foundationStain(p.getX(i),p.getY(i),p.getZ(i)):1;c.set([v,v,v],i*3);}geo.setAttribute('color',new THREE.BufferAttribute(c,3));}if(m===brick||m===concrete||m===stepConcrete||m===groundConcrete||m===apronConcrete||m===foundation||membraneMaterials.has(m)){const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,isFelt=membraneMaterials.has(m);for(let i=0;i<p.count;i++){if(m.userData.localUV)continue;const horizontal=Math.abs(n.getY(i))>.5;uv.setXY(i,(horizontal?p.getX(i):Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/(isFelt?16:m===brick?2.2:m===foundation?2:.8),(horizontal?p.getZ(i):p.getY(i))/(isFelt?16:m===brick?.996:m===foundation?2:.8));}}if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geo);}
  const dummy=new THREE.Object3D();
  function box(x: number,y: number,z: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,angle=0){dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();const stain=m===foundation&&foundationStain;emit(new THREE.BoxGeometry(w,h,d,stain?Math.ceil(w/.3):1,stain?Math.ceil(h/.15):1,stain?Math.ceil(d/.3):1),m,dummy.matrix);}
  function edge(index: number){const a=g[index],b=g[(index+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=new THREE.Vector3((b[0]-a[0])/L,0,(b[1]-a[1])/L);let n=new THREE.Vector3(-u.z,0,u.x);const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(n.x*(mid[0]-building.c[0])+n.z*(mid[1]-building.c[1])<0)n.negate();
    // Recess walls need the polygon winding, rather than the centroid heuristic.
    let area=0;for(let i=0;i<g.length;i++){const p=g[i],q=g[(i+1)%g.length];area+=p[0]*q[1]-q[0]*p[1];}n.set(u.z,0,-u.x).multiplyScalar(Math.sign(area));
    const angle=Math.atan2(-u.z,u.x),at=(x: number,y: number,d=0)=>new THREE.Vector3(a[0]-ox+u.x*x+n.x*d,y,a[1]-oz+u.z*x+n.z*d);
    const block=(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0,roofCovered=false)=>{
      // The adjacent balcony pier must finish at the recessed side-wall plane,
      // not project back to the old corner after that wall has stepped inward.
      if(design.sideWallStep&&index===(design.sideWallStep.edge+1)%g.length&&x<design.sideWallStep.depth){const end=x+w;x=design.sideWallStep.depth;w=end-x;if(w<=1e-6)return;}
      // Align end faces to adjoining facade planes. Defer their visibility
      // decision until all neighbours exist: different ground levels leave
      // parts of these caps exposed. Only overlapping portions are removed.
      const atStart=Math.abs(x)<1e-6,atEnd=Math.abs(x+w-L)<1e-6;
      if((m===brick||m===foundation||(m===dark&&index===6))&&offset<0&&Math.abs(offset+d)<1e-6&&(atStart||atEnd)){
        const geo=new THREE.BoxGeometry(w,h,d),indices=Array.from(geo.index!.array);
        // Match buried ends to the adjoining facade plane before removing their
        // caps. A square uncapped end leaves a wedge on non-orthogonal corners.
        const pos=geo.attributes.position;
        for(let j=0;j<pos.count;j++){
          const start=atStart&&Math.abs(pos.getX(j)+w/2)<1e-6,end=atEnd&&Math.abs(pos.getX(j)-w/2)<1e-6;
          if(!start&&!end)continue;
          const neighbour=start?(index+g.length-1)%g.length:(index+1)%g.length;
          const na=g[neighbour],nb=g[(neighbour+1)%g.length],dx=nb[0]-na[0],dz=nb[1]-na[1],nl=Math.hypot(dx,dz);
          const nn=new THREE.Vector3(dz/nl,0,-dx/nl).multiplyScalar(Math.sign(area));
          const depth=offset+d/2-Math.sign(area)*pos.getZ(j),denom=nn.dot(u);
          if(Math.abs(denom)>.9){const shift=-nn.dot(n)*depth/denom;if(Math.abs(shift)<.08)pos.setX(j,pos.getX(j)+shift);}
        }
        const p=at(x+w/2,y+h/2,offset+d/2);dummy.position.copy(p);dummy.rotation.set(0,angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();
        if(!closedConstructionAudit){
          for(let j=0;j<12;j+=3)if((atEnd&&j<6)||(atStart&&j>=6))pendingCaps.push({material:m,points:indices.slice(j,j+3).map(k=>new THREE.Vector3().fromBufferAttribute(pos,k).applyMatrix4(dummy.matrix))});
          geo.setIndex(indices.filter((_,j)=>!(atEnd&&j<6)&&!(atStart&&j>=6&&j<12)));
        }
        if(roofCovered&&!closedConstructionAudit)geo.setIndex(Array.from(geo.index!.array).filter(k=>geo.attributes.normal.getY(k)<.5));
        emit(geo,m,dummy.matrix);return;
      }
      const p=at(x+w/2,y+h/2,offset+d/2);
      if(roofCovered){const geo=new THREE.BoxGeometry(w,h,d);if(!closedConstructionAudit)geo.setIndex(Array.from(geo.index!.array).filter(k=>geo.attributes.normal.getY(k)<.5));dummy.position.copy(p);dummy.rotation.set(0,angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();emit(geo,m,dummy.matrix);}
      else box(p.x,p.y,p.z,w,h,d,m,angle);
    };return {L,at,block,angle,n};
  }
  function beam(a: THREE.Vector3,b: THREE.Vector3,r: number,m: THREE.MeshStandardMaterial){const direction=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());dummy.updateMatrix();emit(new THREE.CylinderGeometry(r,r,direction.length(),6),m,dummy.matrix);}
  function window(p: Pick<ReturnType<typeof edge>,'block'> & Partial<Pick<ReturnType<typeof edge>,'at'>>,x: number,y: number,w=1.3,h=1.45,frame=trim,curtains=false,annexHood=false,division=.5){const inset=annexHood?0:.31;
    if(!annexHood){
      // Continuous masonry reveals join the outer wall to the inset frame/backing.
      // Without this tunnel, oblique sunlight escapes between two detached planes.
      const reveal=y<1.8?foundation:brick;
      // Only the four tunnel surfaces. Box-shaped reveals added coplanar front
      // strips over the masonry and lintel, which flickered during camera motion.
      const surface=(points: number[][])=>{let q=points.map(([xx,yy,d])=>p.at!(xx,yy,d)),centre=p.at!(x+w/2,y+h/2,-.15),normal=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));if(normal.dot(centre.sub(q[0]))<0)q.reverse();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>q[i].toArray()),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(12),2));geometry.computeVertexNormals();emit(geometry,reveal,new THREE.Matrix4());};
      for(const xx of [x-.08,x+w+.08])surface([[xx,y-.08,0],[xx,y+h+.08,0],[xx,y+h+.08,-.31],[xx,y-.08,-.31]]);
      for(const yy of [y-.08,y+h+.08])surface([[x-.08,yy,0],[x+w+.08,yy,0],[x+w+.08,yy,-.31],[x-.08,yy,-.31]]);
    }
    p.block(x-.08,y-.08,w+.16,h+.16,.045,dark,.015-inset);p.block(x,y,w,h,.045,glass,.065-inset);if(curtains)for(let j=0;j<8;j++)p.block(x+j*w/8,y,.055,h,.015,j%2?trim:concrete,.117-inset);for(const xx of [x-.06,x+w*division-.025,x+w])p.block(xx,y-.06,.06,h+.12,.07,frame,.12-inset);for(const yy of [y-.06,y+h])p.block(x-.06,yy,w+.12,.06,.07,frame,.12-inset);if(annexHood)p.block(x-.16,y+h+.12,w+.32,.19,.16,concrete,.02);else if(y>=1.8)p.block(x-.31,y+h+.12,w+.62,.19,.13,lintelMaterial,-.13);if(annexHood)p.block(x-.1,y-.15,w+.2,.07,.24,concrete,.02);else{p.block(x-.08,y-.085,w+.16,.025,.26,sillMetal,-.20);p.block(x-.08,y-.10,w+.16,.04,.018,sillMetal,.042);}}
  const height=design.height;
  const roofLevel=height-.22,mainParapetTop=roofLevel+(design.mainParapetAboveRoof??.22);
  // Recessed balcony back walls must end BELOW the roof deck. Previously their
  // upper 22 cm pierced the roof as five separate brick strips inside the edge.
  for(let i=0;i<g.length;i++){
    const face=edge(i),recessed=design.balconyEdges.includes(i),step=design.sideWallStep?.edge===i?design.sideWallStep:null;
    const p=step?{...face,block:(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0)=>{
      const split=face.L-step.width,end=x+w;
      if(x<split)face.block(x,y,Math.min(end,split)-x,h,d,m,offset);
      if(end>split)face.block(Math.max(x,split),y,end-Math.max(x,split),h,d,m,offset-step.depth);
    }}:face;

    const vent=design.vents?.find(v=>v.edge===i),cuts=[];
    // Main entrance back wall is rebuilt below with the reference door and
    // render transition. Do not leave a second facade behind those surfaces.
    if(i===6)cuts.push({x:0,y:.95,w:p.L,h:2.4});
    if(vent)for(let j=0;j<vent.count;j++)cuts.push({x:p.L*(j+1)/(vent.count+1)-.11,y:27.5,w:.22,h:.13});
    for(let r=0;r<9;r++){
      let x,w=1.3,y=2.8+r*2.85;
      if(i===14)x=p.L*.76;
      if(i===16&&r>0){w=1.65;x=(p.L-w)/2;}
      if(i===19)x=p.L*.83;
      if(i===4){x=p.L*.32;w=p.L*.37;}
      if(i===6&&r>0){w=2.2;x=(p.L-w)/2;y-=.15;}
      if(i===8)x=p.L*.1;
      if(x!==undefined){cuts.push({x:x-.31,y:y+1.45+.12,w:w+.62,h:.19});cuts.push({x:x-.08,y:y-.08,w:w+.16,h:1.61});}
    }
    if([4,8,14,19].includes(i)){const x=i===8?p.L*.1:i===4?p.L*.32:i===14?p.L*.76:p.L*.65;cuts.push({x:x-.08,y:.27,w:1.36,h:.96});}
    if(i===18)cuts.push({x:(p.L-1.25)/2-.08,y:.27,w:1.41,h:.96});
    if(cuts.length){
      const top=recessed?roofLevel-.04:roofLevel,ys=[0,1.8,top,...cuts.flatMap(c=>[c.y,c.y+c.h])].filter(y=>y>=0&&y<=top).sort((a,b)=>a-b);
      for(let row=0;row<ys.length-1;row++){const lo=ys[row],hi=ys[row+1];if(hi-lo<1e-6)continue;
        const spans=cuts.filter(c=>c.y<(lo+hi)/2&&c.y+c.h>(lo+hi)/2).sort((a,b)=>a.x-b.x);let x=0;
        for(const c of spans){if(c.x>x)p.block(x,lo,c.x-x,hi-lo,.13,lo<1.8?foundation:brick,recessed?(lo<1.8?-1.13:-1.05):-.13);x=Math.max(x,c.x+c.w);}if(x<p.L)p.block(x,lo,p.L-x,hi-lo,.13,lo<1.8?foundation:brick,recessed?(lo<1.8?-1.13:-1.05):-.13);
      }
      if(vent)for(let j=0;j<vent.count;j++)p.block(p.L*(j+1)/(vent.count+1)-.11,27.5,.22,.13,.012,dark,-.145);
    }else {p.block(0,0,p.L,1.8,.13,foundation,recessed?-1.13:-.13);p.block(0,1.8,p.L,(recessed?roofLevel-.04:roofLevel)-1.8,.13,brick,recessed?-1.05:-.13);}
    const stepped=design.steppedFacadeEdges?.includes(i),setback=stepped?design.roofShelfDepth:0;
    if(stepped){
      // The shared roof membrane is the shelf's sole top surface. Previously
      // the concrete top lay only 1 mm below it and flickered at grazing angles.
      const shoulder=design.balconyShoulder;
      p.block(shoulder,roofLevel-.06,p.L-2*shoulder,.101,setback+.14,concrete,-setback-.14,true);
    }
  }
  function offsetOutline(points: Polygon,offsets: number | number[]): Polygon{
    const sign=Math.sign(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0));
    const lines=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),d=Array.isArray(offsets)?offsets[i]:offsets;return {a:[a[0]+sign*dz/L*d,a[1]-sign*dx/L*d],u:[dx/L,dz/L]};});
    return lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],cross=a.u[0]*b.u[1]-a.u[1]*b.u[0],dx=b.a[0]-a.a[0],dz=b.a[1]-a.a[1],t=(dx*b.u[1]-dz*b.u[0])/cross;return [a.a[0]+a.u[0]*t,a.a[1]+a.u[1]*t];});
  }
  function ring(outer: Polygon,inner: Polygon,y: number,h: number,material: THREE.MeshStandardMaterial){const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(p[0]-ox,-(p[1]-oz))));shape.holes.push(new THREE.Path(inner.map(p=>new THREE.Vector2(p[0]-ox,-(p[1]-oz))).reverse()));const geometry=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);emit(geometry,material,new THREE.Matrix4());}
  const roofFootprint: Polygon=[],roofOffsets: number[]=[];
  for(let i=0;i<g.length;i++){
    const previous=(i+g.length-1)%g.length,step=design.sideWallStep;
    if(step&&i===step.edge){const p=edge(i);roofFootprint.push(g[i]);roofOffsets.push(0);for(const d of [0,-step.depth]){const v=p.at(p.L-step.width,0,d);roofFootprint.push([v.x+ox,v.z+oz]);roofOffsets.push(0);}}
    else if(step&&previous===step.edge){const p=edge(previous),v=p.at(p.L,0,-step.depth);roofFootprint.push([v.x+ox,v.z+oz]);roofOffsets.push(design.steppedFacadeEdges?.includes(i)?-design.roofShelfDepth+.14:0);}
    else if(design.entranceReturnStep?.edge===i){
      const p=edge(i),step=design.entranceReturnStep,width=p.L*step.widthFraction,start=(p.L-width)/2;
      roofFootprint.push(g[i]);roofOffsets.push(0);
      for(const [x,d] of [[start,0],[start,step.projection],[start+width,step.projection],[start+width,0]]){
        const v=p.at(x,0,d);roofFootprint.push([v.x+ox,v.z+oz]);roofOffsets.push(0);
      }
    }else{roofFootprint.push(g[i]);roofOffsets.push(design.steppedFacadeEdges?.includes(i)?-design.roofShelfDepth+.14:0);}
  }
  const outerParapet=offsetOutline(roofFootprint,roofOffsets);
  const innerParapet=offsetOutline(outerParapet,-.28),innerLining=offsetOutline(innerParapet,-.025);
  ring(outerParapet,innerParapet,roofLevel,mainParapetTop-roofLevel,brick);
  ring(innerParapet,innerLining,roofLevel,mainParapetTop-roofLevel,roof);
  // Projection 45 mm and return 120 mm are provisional photo proportions.
  ring(offsetOutline(outerParapet,.045),offsetOutline(innerParapet,-.045),mainParapetTop+.068,.012,roofEdgeMetal);
  ring(offsetOutline(outerParapet,.045),offsetOutline(outerParapet,.033),mainParapetTop-.04,.108,roofEdgeMetal);
  ring(offsetOutline(innerParapet,-.033),offsetOutline(innerParapet,-.045),mainParapetTop-.04,.108,roofEdgeMetal);
  root.userData.roofEnvelope={outer:outerParapet,inner:innerParapet,lining:innerLining,bottom:roofLevel,top:mainParapetTop};
  if(design.entranceReturnStep){
    const step=design.entranceReturnStep,p=edge(step.edge),width=p.L*step.widthFraction,start=(p.L-width)/2;
    p.block(start,1.8,width,roofLevel-1.8,step.projection+.13,brick,-.13);
    // The projection continues through the parapet in the shared roof outline.
    // No separate premature cap at roof-deck height (September 2023 reference).
  }
  const shape=new THREE.Shape(roofFootprint.map(p=>new THREE.Vector2(p[0]-ox,-(p[1]-oz))));const cap=new THREE.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(0,roofLevel+.041,0);emit(cap,roof,new THREE.Matrix4());

    const apronGround=(p: THREE.Vector3)=>{
      if(!terrain)return 0;
      let surface=-Infinity;const px=p.x+ox,pz=p.z+oz;
      for(const t of terrain.siteGround??[]){const den=(t[4]-t[7])*(t[0]-t[6])+(t[6]-t[3])*(t[1]-t[7]);if(Math.abs(den)<1e-10)continue;const a=((t[4]-t[7])*(px-t[6])+(t[6]-t[3])*(pz-t[7]))/den,b=((t[7]-t[1])*(px-t[6])+(t[0]-t[6])*(pz-t[7]))/den,c=1-a-b;if(Math.min(a,b,c)>=-1e-6)surface=Math.max(surface,a*t[2]+b*t[5]+c*t[8]);}
      if(Number.isFinite(surface))return surface-level;
      const X=Math.max(0,Math.min(terrain.width-1.001,(p.x+ox-terrain.origin[0])/terrain.step)),Z=Math.max(0,Math.min(terrain.height-1.001,(p.z+oz-terrain.origin[1])/terrain.step)),i=Math.floor(X),j=Math.floor(Z),u=X-i,v=Z-j,k=j*terrain.width+i,t=terrain.values;
      return (t[k]*(1-u)*(1-v)+t[k+1]*u*(1-v)+t[k+terrain.width]*(1-u)*v+t[k+terrain.width+1]*u*v)/10-level;
    };
    if(design.entranceReturnStep){
      const step=design.entranceReturnStep,p=edge(step.edge),width=p.L*step.widthFraction,start=(p.L-width)/2;
      // One uninterrupted foundation face reaches below the sloping ground,
      // rather than stopping at the model's local-zero datum. Sample across
      // the strip and its full depth; the 3 cm burial matches other foundations.
      let bottom=0;
      const divisions=Math.ceil(width/.25);
      for(let i=0;i<=divisions;i++)for(const depth of [-.13,step.projection])bottom=Math.min(bottom,apronGround(p.at(start+width*i/divisions,0,depth))-.03);
      p.block(start,bottom,width,1.8-bottom,step.projection+.13,foundation,-.13);
      root.userData.entranceReturnProjection={edge:step.edge,start,width,projection:step.projection,bottom};
    }
    function apron(p: ReturnType<typeof edge>,x: number,width: number,depth: number,offset: number,material=concrete,lift=.003){
      if(material===concrete)material=apronConcrete;
      const earlier: Polygon[]=[...(root.userData.groundPatches??[])];
      (root.userData.groundPatches??=[]).push([[x,offset],[x+width,offset],[x+width,offset+depth],[x,offset+depth]].map(([u,d])=>{const q=p.at(u,0,d);return [q.x+ox,q.z+oz];}));
      // Clip each actual ground triangle to the apron rectangle. This preserves
      // every terrain break inside the strip, instead of interpolating its corners.
      const origin=p.at(0,0,0),u=p.at(1,0,0).sub(origin),n=p.at(0,0,1).sub(origin);
      const triangles=terrain?.siteGround;
      if(triangles?.length){
        for(const t of triangles){
          let poly=[0,3,6].map(i=>{const dx=t[i]-ox-origin.x,dz=t[i+1]-oz-origin.z;return [dx*u.x+dz*u.z,dx*n.x+dz*n.z,t[i+2]-level+lift];});
          for(const plane of [(q: number[])=>q[0]-x,(q: number[])=>x+width-q[0],(q: number[])=>q[1]-offset,(q: number[])=>offset+depth-q[1]]){
            const clipped=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b);if(da>=0)clipped.push(a);if((da>=0)!==(db>=0)){const f=da/(da-db);clipped.push(a.map((v,k)=>v+(b[k]-v)*f));}}poly=clipped;
          }
          if(poly.length<3)continue;
          let pieces=[poly];
          for(const old of earlier){
            const clip=old.map(q=>{const dx=q[0]-ox-origin.x,dz=q[1]-oz-origin.z;return [dx*u.x+dz*u.z,dx*n.x+dz*n.z];});
            const area=clip.reduce((s,a,i)=>{const b=clip[(i+1)%clip.length];return s+a[0]*b[1]-a[1]*b[0];},0),sign=Math.sign(area),outside=[];
            for(const piece of pieces){let inside=piece;
              for(let e=0;e<clip.length&&inside.length;e++){const a=clip[e],b=clip[(e+1)%clip.length],plane=(q: number[])=>sign*((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0])),yes=[],no=[];
                for(let j=0;j<inside.length;j++){const a=inside[j],b=inside[(j+1)%inside.length],da=plane(a),db=plane(b);(da>=0?yes:no).push(a);if((da>=0)!==(db>=0)){const f=da/(da-db),q=a.map((v,k)=>v+(b[k]-v)*f);yes.push(q);no.push(q);}}
                if(no.length>=3)outside.push(no);inside=yes;
              }
            }pieces=outside;
          }
          for(const piece of pieces){
          const points=piece.map(q=>p.at(q[0],q[2],q[1])),positions=[];
          for(let i=1;i<points.length-1;i++){let a=points[0],b=points[i],c=points[i+1];if(b.clone().sub(a).cross(c.clone().sub(a)).y<0)[b,c]=[c,b];positions.push(...a.toArray(),...b.toArray(),...c.toArray());}
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));geo.computeVertexNormals();emit(geo,material,new THREE.Matrix4());
          }
        }
      }else{
        // Standalone geometry checks without rendered terrain use the DTM fallback.
        for(let start=x;start<x+width;start+=.25){const w=Math.min(.25,x+width-start),point=p.at(start+w/2,0,offset+depth/2);p.block(start,apronGround(point)-.025,w,.06,depth,material,offset);}
      }
    }
  if(design.baseProjection){
    for(let i=0;i<g.length;i++){
      if([6,16,19].includes(i))continue; // Doorways and approved annex access stay untouched.
      const p=edge(i),projection=design.baseProjection;
      if(!design.balconyEdges.includes(i)){
        for(let x=0;x<p.L;){const split=design.sideWallStep?.edge===i?p.L-design.sideWallStep.width:p.L,w=Math.min(.25,p.L-x,x<split?split-x:Infinity),step=x>=split?(design.sideWallStep?.depth??0):0;
          const y=Math.min(apronGround(p.at(x,0,-step)),apronGround(p.at(x+w,0,-step)))-.03;
          if(y<0)p.block(x,y,w,-y,.13,foundation,-.13-step);x+=w;
        }
      }
      if(design.balconyEdges.includes(i)){
        // Continue only below the existing base datum: preserve recess depth,
        // openings and pier widths, but connect their feet to the sloping ground.
        for(let x=.12;x<p.L-.12;x+=.25){const w=Math.min(.25,p.L-.12-x),y=Math.min(apronGround(p.at(x,0,-.94)),apronGround(p.at(x+w,0,-.94)))-.03;
          if(y<0)p.block(x,y,w,-y,.04,foundation,-.98);
        }
        const pierWidth=design.balconyShoulder??.18;for(const x of [0,p.L-pierWidth]){const y=Math.min(...[x,x+pierWidth].flatMap(xx=>[-1.13,0].map(d=>apronGround(p.at(xx,0,d)))))-.03;if(y<0)p.block(x,y,pierWidth,-y,1.13,foundation,-1.13);}
        apron(p,.10,p.L-.20,.48,-1.08);
        for(const x of [-.08,p.L-.26])apron(p,x,.34,1+projection,-1);
      }else if(design.sideWallStep?.edge===i){
        const step=design.sideWallStep,split=p.L-step.width;
        apron(p,-.14,split+.14,projection+.16,-.16);
        apron(p,split-.02,step.width+.16,projection+.16,-.16-step.depth);
      }else apron(p,-.14,p.L+.28,projection+.20,-.20);
    }
  }
  const shaftAngle=Math.atan2(g[2][1]-g[1][1],g[2][0]-g[1][0]);
  const shaft=[[-2.7,-2.7],[2.7,-2.7],[2.7,2.7],[-2.7,2.7]].map(([x,z])=>[building.c[0]+x*Math.cos(shaftAngle)-z*Math.sin(shaftAngle),building.c[1]+x*Math.sin(shaftAngle)+z*Math.cos(shaftAngle)]);
  for(let i=0;i<shaft.length;i++){const a=shaft[i],b=shaft[(i+1)%shaft.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(-dz,dx);
    const rearDoor=design.liftRoofDetails&&i===3,doorX=3.05,doorW=.90,doorY=roofLevel+.041,doorH=2;
    const panel=(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0)=>box(a[0]+dx*(x+w/2)/length+dz/length*offset-ox,y+h/2,a[1]+dz*(x+w/2)/length-dx/length*offset-oz,w,h,d,m,angle);
    if(rearDoor){
      panel(0,27.9,doorX,3.3,.09,trim);panel(doorX+doorW,27.9,length-doorX-doorW,3.3,.09,trim);
      panel(doorX,27.9,doorW,doorY-27.9,.09,trim);panel(doorX,doorY+doorH,doorW,31.2-doorY-doorH,.09,trim);
      panel(doorX,doorY,doorW,doorH,.08,dark,.025);
      for(const x of [doorX-.045,doorX+doorW])panel(x,doorY,.045,doorH+.045,.06,metal,.06);
      panel(doorX-.045,doorY+doorH,doorW+.09,.045,.06,metal,.06);
      panel(doorX+.12,doorY+.9,.035,.16,.025,sillMetal,.08);
      root.userData.liftDoor={edge:3,width:doorW,height:doorH};
    }else panel(0,27.9,length,3.3,.09,trim);
    for(let x=.04;x<length;x+=.11){if(rearDoor&&x>doorX-.05&&x<doorX+doorW+.05){panel(x,doorY+doorH+.045,.028,31.2-doorY-doorH-.045,.14,concrete);}else panel(x,27.9,.028,3.3,.14,concrete);}
    box((a[0]+b[0])/2-ox,31.23,(a[1]+b[1])/2-oz,length,.1,.18,roof,angle);
  }
  const shaftCap=new THREE.ShapeGeometry(new THREE.Shape(shaft.map(p=>new THREE.Vector2(p[0]-ox,-(p[1]-oz)))));shaftCap.rotateX(-Math.PI/2);shaftCap.translate(0,31.2,0);emit(shaftCap,roof,new THREE.Matrix4());
  if(design.liftRoofDetails){
    const x=building.c[0]-.8*Math.cos(shaftAngle)+.2*Math.sin(shaftAngle)-ox,z=building.c[1]-.8*Math.sin(shaftAngle)-.2*Math.cos(shaftAngle)-oz;
    for(const [y,top,bottom,h,m] of [[31.23,.26,.30,.06,metal],[31.44,.13,.13,.38,dark],[31.66,.07,.27,.12,metal]] as const){
      dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();emit(new THREE.CylinderGeometry(top,bottom,h,12),m,dummy.matrix);
    }
    root.userData.liftCowl={x,y:31.72,z};
  }

  const balconyEdges=design.balconyEdges;
  for(let i=0;i<g.length;i++){const original=edge(i),L=original.L;
    const shoulder=design.steppedFacadeEdges?.includes(i)?design.balconyShoulder:0,scale=(L-2*shoulder)/L;
    // Front panels finish inside continuous brick cheeks. Keep the recessed
    // rear wall/doors fixed and shorten slabs, rather than burying those doors.
    const occupied= (y: number)=>balconyEdges.includes(i)&&y>=1.9;
    const p={...original,block:(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0)=>{
      if(occupied(y)){if(offset>=0)offset-=.30;else if(offset+d>-.05)d=-.05-offset;original.block(shoulder+x*scale,y,w*scale,h,d,m,offset);}
      else original.block(x,y,w,h,d,m,offset);
    },at:(x: number,y: number,d=0)=>original.at(occupied(y)?shoulder+x*scale:x,y,occupied(y)&&d>=0?d-.36:d)};
    if(shoulder)for(const x of [0,L-shoulder])original.block(x,1.8,shoulder,roofLevel+.041-1.8,1.05,brick,-1.05,true);
    if(balconyEdges.includes(i)){
      // Ribs meet their backing face; they do not overlap its front plane.
      const crownBottom=height-.8,crownHeight=roofLevel-.06-crownBottom;
      p.block(.05,crownBottom,L-.1,crownHeight,.16,trim,.05);
      for(let x=.08;x<L-.05;x+=.09)p.block(x,crownBottom,.025,crownHeight,.035,concrete,.21);
      if(i===18){const x=(L-1.25)/2-.08,w=1.41;p.block(.12,0,L-.24,.27,.04,foundation,-.98);p.block(.12,1.23,L-.24,.57,.04,foundation,-.98);p.block(.12,.27,x-.12,.96,.04,foundation,-.98);p.block(x+w,.27,L-.12-x-w,.96,.04,foundation,-.98);}else{
      p.block(.12,0,L-.24,1.8,.04,[2,9,11,13,18].includes(i)?foundation:dark,[2,9,11,13,18].includes(i)?-.98:.015);
      }
      for(const x of [0,L-shoulder])p.block(x,0,shoulder,1.8,1.13,foundation,-1.13);
      for(let r=0;r<design.floors;r++){const y=1.9+r*design.floorPitch,brown=(i===2&&r===1)||(i===11&&r===1),timber=i===9&&r===0,frame=brown||timber?wood:trim;
        p.block(.05,y,L-.1,1.0,.16,trim,.05);
        for(let x=.08;x<L-.05;x+=.09)p.block(x,y,.025,1.0,.035,concrete,.21);
        // The 17 cm band height is inferred from the supplied photo.
        p.block(.05,y+1.0,L-.1,.17,.025,paleMetal,.215);
        const rearBrown=i===18&&design.rearBrownFloors.includes(r),balconyFrame=rearBrown?wood:frame;
        const frameInset=design.balconyFrameInset??0;
        const panes= brown||rearBrown?6:5,w=(L-.3)/panes,open=design.openBalconies.some(([edge,floor])=>edge===i&&floor===r);
        if(open){
          const door=L*.43;
          p.block(.04,y+.1,L-.08,2.65,.035,concrete,-.9);
          p.block(door,y+.12,.82,2.42,.05,trim,-.81);
          p.block(door+.08,y+.82,.66,1.6,.025,glass,-.75);
          for(const [x,width] of [[.15,door-.22],[door+.9,L-door-1.05]]){
            p.block(x,y+1.18,width,1.34,.05,trim,-.81);
            p.block(x+.065,y+1.25,width-.13,1.2,.025,glass,-.75);
          }
          for(const yy of [y+1.18,y+1.38])p.block(.08,yy,L-.16,.055,.065,concrete,.25);
          for(let x=.12;x<L;x+=.7)p.block(x,y+1.1,.035,.31,.05,metal,.25);
          p.block(.02,y,L-.04,.1,1.25,concrete,-1.0);
        }else{
          for(let j=0;j<panes;j++){p.block(.15+j*w,y+1.22,w-.04,1.4,.04,glass,.12-frameInset);if(r===0||brown)for(let k=0;k<3;k++)p.block(.18+j*w+k*w/4,y+1.23,.035,1.43,.014,timber?wood:r===0?trim:green,.17-frameInset);p.block(.12+j*w,y+1.2,.055,1.48,.1,balconyFrame,.19-frameInset);}
          for(const yy of [y+1.17,y+2.65])p.block(.08,yy,L-.16,.07,.1,balconyFrame,.19-frameInset);
        }
        p.block(.02,y+2.8,L-.04,.1,1.25,concrete,-1.0);
        if(i===13&&r===0){
          for(let bay=0;bay<3;bay++){const cx=.15+(bay+.5)*(L-.3)/3,cy=y+1.9;
            for(let spoke=0;spoke<12;spoke++){const a=spoke*Math.PI/6;beam(p.at(cx,cy,.34),p.at(cx+Math.cos(a)*(L-.3)/6,cy+Math.sin(a)*.64,.34),.014,trim);}
            for(const xx of [cx-(L-.3)/6,cx+(L-.3)/6])beam(p.at(xx,y+1.2,.34),p.at(xx,y+2.65,.34),.018,trim);
          }
        }
      }
    }
    for(let r=0;r<9;r++){const y=2.8+r*2.85;
      if(i===14)window(p,L*.76,y,1.3,1.45,trim,false,false,r===0?.3:.5);
      if(i===16&&r>0)window(p,(L-1.65)/2,y,1.65);
      if(i===19)window(p,L*.83,y);
      if(i===4)window(p,L*.32,y,L*.37,1.45,r===2?wood:trim,r===2);
      if(i===6&&r>0)window(p,(L-2.2)/2,y-.15,2.2,1.45);
      if(i===8)window(p,L*.1,y); // Single column: the two spurious lower windows are removed.
    }
    if([4,8,14,19].includes(i))window(p,i===8?L*.1:i===4?L*.32:i===14?L*.76:L*.65,.35,1.2,.8);
    if(i===18)window({...p,at:(x: number,y: number,d=0)=>p.at(x,y,d-.94),block:(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0)=>p.block(x,y,w,h,d,m,offset-.94)},(L-1.25)/2,.35,1.25,.8);
  }
  // September 2023 reference: the entrance fills the bay between both walls.
  // The old 7% margins left grass exposed beside the stair and a short canopy.
  const entryFace=edge(6),entry={...entryFace,at:(x: number,y: number,d: number)=>entryFace.at(entryFace.L-x,y,d),block:(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0)=>entryFace.block(entryFace.L-x-w,y,w,h,d,m,offset)},ew=entry.L,ex=0;
  const stairX=ew*.43,stairW=ew-stairX;
  // Photo proportions are provisional: a single narrower door surrounded by
  // masonry, with roughcast rising one third of its height from the landing.
  const doorW=Math.min(1.2,stairW*.43),doorH=2.08,doorBase=.95;
  const doorX=stairX+stairW*.58-doorW/2,renderTop=doorBase+doorH/3;
  entry.block(0,.95,stairX,2.4,.07,dark,-.07);
  for(const [x,w] of [[stairX,doorX-stairX],[doorX+doorW,entry.L-doorX-doorW]]){
    entry.block(x,doorBase,w,renderTop-doorBase,.13,foundation,-.13);
    entry.block(x,renderTop,w,3.35-renderTop,.13,brick,-.13);
  }
  entry.block(doorX,doorBase+doorH,doorW,3.35-doorBase-doorH,.13,brick,-.13);
  entry.block(doorX,doorBase,doorW,doorH,.035,wood,-.04);
  entry.block(doorX+doorW*.45,1.8,doorW*.22,.85,.015,dark,0);
  entry.block(doorX+doorW*.18,1.9,.045,.06,.04,sillMetal,0);
  entry.block(doorX-.27,2.05,.18,.23,.035,dark,.005);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)entry.block(doorX-.25+col*.045,2.08+row*.04,.02,.02,.012,trim,.045);
  root.userData.entranceReference={width:entry.L,doorWidth:doorW,doorHeight:doorH,doorBase,renderTop};
  entry.block(ex+ew*.48,3.25,.24,.08,.24,trim,.5);
    entry.block(0,3.35,entry.L,.18,1.46,concrete,-.04);entry.block(0,3.53,entry.L,.16,1.46,canopyMembrane,-.04);
  // The 38 cm canopy upstand is inferred from the supplied photo.
  entry.block(0,3.53,entry.L,.16,.015,paleMetal,1.42);
  entry.block(0,3.69,entry.L,.012,.075,paleMetal,1.36);
  entry.block(-.02,3.69,entry.L+.04,.38,.025,canopyMembrane,.002);
  for(const x of [-.02,entry.L-.02])entry.block(x,3.69,.04,.38,1.42,canopyMembrane,-.015);
  // Extend entrance solids down into the sampled apron. The old fixed
  // +.02/.05 bottoms left daylight below the landing and stair side faces.
  const entrySolid=(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset: number)=>{
    const bottom=Math.min(y,...[x,x+w].flatMap(xx=>[offset,offset+d].map(dd=>apronGround(entry.at(xx,0,dd))-.03)));
    entry.block(x,bottom,w,y+h-bottom,d,m===concrete?stepConcrete:m,offset);
  };
    entrySolid(-.03,.05,stairX+.03,.9,2.76,concrete,-.04);
  entry.block(ex+.08,.95,ew*.30,2.20,.075,dark,.13);
  entry.block(stairX-.13,.95,.26,2.4,1.05,brick,.02);
    entrySolid(stairX,.05,stairW,.9,1.16,concrete,-.04);
  for(let j=0;j<5;j++)entrySolid(stairX,.02,stairW,.9-j*.18,.32,concrete,1.12+j*.32);
  for(const x of [ex+ew-.06]){for(const [d,y] of [[1.1,.95],[2.6,.08]])beam(entry.at(x,y,d),entry.at(x,y+.95,d),.025,metal);beam(entry.at(x,1.9,1.1),entry.at(x,1.03,2.6),.025,metal);}
  // September 2023 side view: annex outer face aligns with the tiled access path.
  // About six slab widths are visible; 2.4 m is provisional, not surveyed.
  // This supersedes the misleading rear-view balcony-width comparison.
  const annex=edge(19),pathWidth=design.pathWidth;
  // The tiled access follows the outer wing, not this recessed wall plane.
  const pathOffset=Math.max(...g.map(p=>(p[0]-g[19][0])*annex.n.x+(p[1]-g[19][1])*annex.n.z))+.06;
  const annexDepth=pathOffset+pathWidth;
  root.userData.pathClearance={offset:pathOffset,width:pathWidth,outerWall:Math.max(...g.map(p=>(p[0]-g[19][0])*annex.n.x+(p[1]-g[19][1])*annex.n.z))};
  const annexEndX=annex.L*.83,canopyEnd=annex.L,annexStart=design.annexStart??.05;
  root.userData.annexBounds={start:annexStart,end:annexEndX,canopyEnd,depth:annexDepth};
  if(annexStart>.05)apron(annex,-.03,annexStart+.06,.4,-.05);
  // User's outlined 2024 photograph resolves the apparent tall block:
  // the black roof sits behind a solid parapet about one metre higher.
  const annexMembrane=roof,annexRoofY=2.01,parapetTop=annexRoofY+.045+design.annexParapetHeight,parapetThickness=.18;
  membraneMaterials.add(annexMembrane);annexMembrane.map=felt;annexMembrane.bumpMap=feltHeight;annexMembrane.bumpScale=.028;annexMembrane.roughness=1;
  // The weathered band outline is approximate.
  foundationStain=(x,y,z)=>{const along=(x+ox-g[19][0])*Math.cos(annex.angle)-(z+oz-g[19][1])*Math.sin(annex.angle);
    const reach=.52+.07*Math.sin(along*2.1)+.04*Math.sin(along*5.3),depth=parapetTop-y;
    return 1-.48*Math.max(0,Math.min(1,(reach-depth)/.18));};
  annex.block(annexStart,-1.14,annexEndX-annexStart,annexRoofY+1.14,annexDepth,foundation,.02);
  // Keep the membrane inside the concrete shell: its side face must not
  // intersect the exterior parapet and create a flickering horizontal stripe.
  annex.block(annexStart+parapetThickness,annexRoofY,annexEndX-annexStart-parapetThickness,.045,annexDepth-parapetThickness,annexMembrane,.02);
  annex.block(annexStart,annexRoofY,annexEndX-annexStart,parapetTop-annexRoofY,parapetThickness,foundation,annexDepth-parapetThickness+.02);
  annex.block(annexStart,annexRoofY,parapetThickness,parapetTop-annexRoofY,annexDepth,foundation,.02);
  foundationStain=null;
  annex.block(annexStart-.03,parapetTop,annexEndX-annexStart+.06,.012,parapetThickness+.08,roofEdgeMetal,annexDepth-parapetThickness-.02);
  annex.block(annexStart-.03,parapetTop-.10,annexEndX-annexStart+.06,.10,.012,roofEdgeMetal,annexDepth+.048);
  annex.block(annexStart-.04,parapetTop,parapetThickness+.08,.012,annexDepth+.08,roofEdgeMetal,-.02);
  annex.block(annexStart-.04,parapetTop-.10,.012,.10,annexDepth+.08,roofEdgeMetal,-.02);
  annex.block(annexEndX,annexRoofY+.045,canopyEnd-annexEndX,.012,.12,roofEdgeMetal,annexDepth-.01);
  annex.block(canopyEnd-.08,annexRoofY+.045,.08,.012,annexDepth+.11,roofEdgeMetal,.01);
  annex.block(annexEndX,annexRoofY-.07,canopyEnd-annexEndX,.115,.012,roofEdgeMetal,annexDepth+.11);
  annex.block(canopyEnd-.012,annexRoofY-.07,.012,.115,annexDepth+.11,roofEdgeMetal,.01);
  const pipeX=annexStart+(annexEndX-annexStart)*.16,pipeD=annexDepth+.14;
  const pipeGround=apronGround(annex.at(pipeX,0,pipeD)),pipeAt=(x: number,y: number)=>annex.at(x,pipeGround+y,pipeD);
  const pipePoints=[pipeAt(pipeX,-.04),pipeAt(pipeX,.35),pipeAt(pipeX+.08,.46),pipeAt(pipeX+.20,.46),pipeAt(pipeX+.28,.35),pipeAt(pipeX+.28,.26)];
  emit(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pipePoints),24,.035,8,false),metal,new THREE.Matrix4());
  annex.block(annexStart+.18,annexRoofY,annexEndX-annexStart-.18,parapetTop-annexRoofY,.025,annexMembrane,annexDepth-parapetThickness-.005);
  annex.block(annexStart+.18,annexRoofY,.025,parapetTop-annexRoofY,annexDepth-parapetThickness-.02,annexMembrane,.02);
  annex.block(annexStart+.18,annexRoofY,canopyEnd-annexStart-.18,.22,.025,annexMembrane,.02);
  const annexEnd={block:(x: number,y: number,w: number,h: number,d: number,m: THREE.MeshStandardMaterial,offset=0)=>{const p=annex.at(annexEndX+offset+d/2,y+h/2,x+w/2);box(p.x,p.y,p.z,w,h,d,m,annex.angle+Math.PI/2);}};
  const aw=1.65,ax=pathOffset+.18;
  window(annexEnd,ax,.35,aw,1.15,wood,false,true);
  for(let j=0;j<=7;j++)annexEnd.block(ax+j*aw/7,.35,.025,1.15,.025,metal,.23);
  for(let j=0;j<=4;j++)annexEnd.block(ax,.35+j*1.15/4,aw,.025,.025,metal,.23);
  const serviceDoorX=annexEndX+.13,serviceDoorW=canopyEnd-serviceDoorX-.1;
  annex.block(serviceDoorX,-.95,serviceDoorW,2.55,.07,wood,.03);
  annex.block(serviceDoorX+serviceDoorW*.5,-.95,.025,2.55,.025,metal,.105);
  annex.block(annexEndX,1.85,canopyEnd-annexEndX,.16,annexDepth+.08,concrete,.02);
  annex.block(annexEndX,annexRoofY,canopyEnd-annexEndX,.045,annexDepth+.08,annexMembrane,.02);
  beam(annex.at(canopyEnd-.08,-1,annexDepth-.05),annex.at(canopyEnd-.08,1.85,annexDepth-.05),.035,redWood);
  const pathStart=(g[2][0]-g[19][0])*Math.cos(annex.angle)-(g[2][1]-g[19][1])*Math.sin(annex.angle),pathEnd=27.5,slab=.4;
  for(let x=pathStart;x<pathEnd;x+=slab)for(let col=0;col<6;col++){
    const w=Math.min(slab-.024,pathEnd-x);
    annex.block(x,.025,w,.045,slab-.024,stepConcrete,pathOffset+col*slab);
  }
  const stairEnd=pathStart-1.75;
  // Continuous floor under the stairs prevents open gaps exposing the water plane.
  annex.block(4.29,-1.14,annex.L-4.29,.14,annexDepth+.04,stepConcrete,-.02);
  annex.block(annex.L-.02,-1.14,pathStart-annex.L+.04,.14,pathWidth+.04,stepConcrete,pathOffset-.02);
  for(let j=0;j<5;j++)annex.block(pathStart-(j+1)*.35,-1.12,.35,1.12-(j+1)*.2,pathWidth,stepConcrete,pathOffset);
  annex.block(4.31,-1.12,pathStart-4.31,1.12,.12,stepConcrete,annexDepth-.12);
  annex.block(4.29,-1.14,annex.L-4.29,1.14,.12,stepConcrete,-.12);
  annex.block(annex.L,-1.14,pathStart-annex.L,1.14,.12,stepConcrete,pathOffset-.12);
  for(let x=annexEndX+.1;x<=pathStart;x+=2)beam(annex.at(x,0,annexDepth),annex.at(x,.95,annexDepth),.025,redWood);
  beam(annex.at(annexEndX+.1,.95,annexDepth),annex.at(pathStart,.95,annexDepth),.025,redWood);
  for(let j=0;j<3;j++){
    const x=pathStart+.7+j*.95,d=pathOffset+1.58;
    annex.block(x,.13,.62,.94,.67,dark,d);
    annex.block(x-.035,1.07,.69,.07,.74,metal,d-.035);
    annex.block(x+.04,1.14,.54,.035,.55,dark,d+.04);
    for(const xx of [x+.06,x+.56]){
      beam(annex.at(xx,.14,d+.56),annex.at(xx,.14,d+.69),.105,tire);
      beam(annex.at(xx,.9,d+.7),annex.at(xx,1.05,d+.7),.024,metal);
    }
    beam(annex.at(x+.06,1.05,d+.7),annex.at(x+.56,1.05,d+.7),.024,metal);
  }
  const rear=edge(16),rx=.12,rw=rear.L-.24;
  rear.block(rx,.85,rw,2.5,.06,dark,.02);rear.block(rx+.16,.9,rw-.32,2.3,.07,wood,.1);
  rear.block(rx-.1,3.4,rw+.2,.17,1.05,concrete,.02);
  rear.block(rx-.1,3.57,rw+.2,.025,1.05,roof,.02);
  if(!design.rearAccessDraft){
  // The new survey site can lie below local zero; retain tread tops while burying their supports.
  const rearStep=(top: number,depth: number,offset: number)=>{
    let bottom=0;
    for(let i=0;i<=Math.ceil(rear.L/.25);i++)for(const d of [offset,offset+depth])bottom=Math.min(bottom,apronGround(rear.at(rear.L*i/Math.ceil(rear.L/.25),0,d))-.03);
    rear.block(0,bottom,rear.L,top-bottom,depth,stepConcrete,offset);
  };
  rearStep(.85,.85,.02);
  for(let j=0;j<5;j++)rearStep(.85-j*.17,.3,.87+j*.3);
  for(const x of [rx+.04,rx+rw-.04]){beam(rear.at(x,.85,.85),rear.at(x,1.75,.85),.022,redWood);beam(rear.at(x,.05,2.3),rear.at(x,.95,2.3),.022,redWood);beam(rear.at(x,1.75,.85),rear.at(x,.95,2.3),.022,redWood);}
  }
  const grille=edge(14),gx=grille.L*.76,gd=-.045,gx0=gx+.04,gx1=gx+1.26,gy0=2.84,gy1=4.21;
  for(let j=0;j<=12;j++){const a=j*Math.PI/24,dx=Math.cos(a),dy=Math.sin(a),length=Math.min((gx1-gx0)/Math.max(dx,.0001),(gy1-gy0)/Math.max(dy,.0001));beam(grille.at(gx0,gy0,gd),grille.at(gx0+dx*length,gy0+dy*length,gd),.012,trim);}
  for(const x of [gx0,gx1])beam(grille.at(x,gy0,gd),grille.at(x,gy1,gd),.018,trim);
  for(const y of [gy0,gy1])beam(grille.at(gx0,y,gd),grille.at(gx1,y,gd),.018,trim);
  for(let j=0;j<24;j++){const a=j*Math.PI/48,b=(j+1)*Math.PI/48;beam(grille.at(gx0+.98*Math.cos(a),gy0+.98*Math.sin(a),gd),grille.at(gx0+.98*Math.cos(b),gy0+.98*Math.sin(b),gd),.012,trim);}
  const signWall=edge(1);
  function plaque(text: string,x: number,y: number,w: number,h: number){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#f3f2e8';ctx.fillRect(0,0,512,256);ctx.fillStyle='#263130';ctx.font=`bold ${text===design.number?200:105}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,133);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=mat('#ffffff');m.map=t;m.userData.flushPlaque=true;const right=new THREE.Vector3(signWall.n.z,0,-signWall.n.x),matrix=new THREE.Matrix4().makeBasis(right,new THREE.Vector3(0,1,0),signWall.n);matrix.setPosition(signWall.at(x,y,.0045));emit(new THREE.BoxGeometry(w,h,.003),m,matrix);}
  plaque(design.number,signWall.L-.7,4,.42,.4);plaque(design.street,signWall.L-.7,3.62,.85,.25);
  const fp=edge(8),fx=fp.L*.1;fp.block(fx,5.65,1.3,.22,.3,wood,-.12);
  // Position and length are approximate, referenced to the lowest balcony frame.
  const flagX=fp.L-.85;fp.block(flagX,3.6,.09,.32,.035,metal,0);
  beam(fp.at(flagX+.045,3.65,.025),fp.at(flagX+.045,3.92,.23),.024,metal);
  for(let j=0;j<12;j++){const p=fp.at(fx+.08+j*.1,5.95+.08*Math.sin(j),.09);dummy.position.copy(p);dummy.rotation.set(0,0,0);dummy.updateMatrix();emit(new THREE.IcosahedronGeometry(.095,0),j%3?flower:green,dummy.matrix);}
  const bp=edge(2),dish=bp.at(bp.L-.25,8.6,.65);beam(bp.at(bp.L-.25,8.3,.12),dish,.035,metal);dummy.position.copy(dish);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),bp.n.clone().add(new THREE.Vector3(0,.25,0)).normalize());dummy.scale.set(1,1,.22);dummy.updateMatrix();emit(new THREE.SphereGeometry(.42,16,10),trim,dummy.matrix);dummy.scale.set(1,1,1);
  function bench(p: ReturnType<typeof edge>,x: number,d: number){for(let j=0;j<5;j++)p.block(x,.45,2,.05,.075,redWood,d+j*.09);for(let j=0;j<6;j++)p.block(x,.57+j*.1,2,.07,.065,redWood,d);for(const xx of [x+.25,x+1.75]){beam(p.at(xx,.05,d+.16),p.at(xx,.48,d+.16),.045,metal);beam(p.at(xx,.43,d+.03),p.at(xx,1.13,d+.03),.035,metal);}}
  bench(edge(8),edge(8).L*.63,4.35);
  const grassBench=edge(8),bx=-10.5;grassBench.block(bx,.47,2,.08,.4,wood,4.35);grassBench.block(bx,.85,2,.28,.07,redWood,4.35);for(const x of [bx+.25,bx+1.75])grassBench.block(x,0,.12,1.12,.17,concrete,4.45);
  if(terrain){
    const asphalt=lift(mat('#83877e'));asphalt.userData.groundSurface=true;const approachAsphalt=lift(asphalt.clone(),.01);
    const ground=(x: number,z: number)=>{const xx=Math.max(0,Math.min(terrain.width-1.001,(x-terrain.origin[0])/terrain.step)),zz=Math.max(0,Math.min(terrain.height-1.001,(z-terrain.origin[1])/terrain.step)),i=Math.floor(xx),j=Math.floor(zz),u=xx-i,v=zz-j,k=j*terrain.width+i,d=terrain.values;return (d[k]*(1-u)*(1-v)+d[k+1]*u*(1-v)+d[k+terrain.width]*(1-u)*v+d[k+terrain.width+1]*u*v)/10-level+.12;};
    function quad(points: Polygon,m: THREE.MeshStandardMaterial){const geo=new THREE.BufferGeometry(),ids=[0,1,2,0,2,3];geo.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>[points[i][0]-ox,ground(...points[i]),points[i][1]-oz]),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(ids.flatMap(i=>[points[i][0],points[i][1]]),2));geo.computeVertexNormals();emit(geo,m,new THREE.Matrix4());}
    const road=[[232.3,555.5,5],[228.8,564.4,8.4],[218,591.9,8.4],[221.8,601.3,5]];
    for(let i=0;i<road.length-1;i++){const a=road[i],b=road[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len,steps=Math.ceil(len);
      const point=(t: number,side: number): Point2=>[a[0]+(b[0]-a[0])*t+nx*(a[2]+(b[2]-a[2])*t)*side/2,a[1]+(b[1]-a[1])*t+nz*(a[2]+(b[2]-a[2])*t)*side/2];
      for(let j=0;j<steps;j++)quad([point(j/steps,-1),point((j+1)/steps,-1),point((j+1)/steps,1),point(j/steps,1)],asphalt);
    }
    const approach=edge(6),width=approach.L,left=0;
    const roadPoint=(x: number,d: number): Point2=>{const p=approach.at(x,0,d);return [p.x+ox,p.z+oz];};
    // Lay continuous concrete into the stair footprint first. Later driveway
    // polygons are clipped against it, rather than stealing a strip at the join.
    // Retain the established concrete apron footprint as stairs widen over it.
    const apronInset=approach.L*.07;
    apron(approach,-.45,apronInset+.50,3.3,-.20);
    apron(approach,approach.L-apronInset-.05,apronInset+.50,3.3,-.20);
    apron(approach,left-.03,width+.06,12.3,-.10,approachAsphalt,.003);
    const walk=edge(8);for(let x=-8;x<walk.L+2;x+=1){const pts=[[x,4.85],[x+1,4.85],[x+1,6.05],[x,6.05]].map(([u,d])=>{const p=walk.at(u,0,d);return[p.x+ox,p.z+oz] as Point2;});quad(pts,groundConcrete);}
  }
  // Keep exposed portions of structural end faces. Neighbours only hide the
  // intersection, not the whole cap (their terrain-dependent bottoms differ).
  // Subtract coplanar triangles before batching to avoid duplicate skins.
  const capOccluders=new Map<THREE.MeshStandardMaterial,{points: THREE.Vector3[]; normal: THREE.Vector3}[]>();
  for(const material of [brick,foundation,dark]){
    const triangles=[];
    for(const part of batches.get(material)||[]){const p=part.attributes.position;for(let i=0;i<p.count;i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      triangles.push({points,normal});
    }}capOccluders.set(material,triangles);
  }
  for(const cap of pendingCaps){
    const normal=cap.points[1].clone().sub(cap.points[0]).cross(cap.points[2].clone().sub(cap.points[0])).normalize();let fragments=[cap.points];
    for(const other of capOccluders.get(cap.material)!){
      if(normal.dot(other.normal)<.99999||other.points.some(p=>Math.abs(p.clone().sub(cap.points[0]).dot(normal))>.0001))continue;
      const remaining=[];
      for(const fragment of fragments){let inside=fragment;
        for(let e=0;e<3&&inside.length;e++){
          const a=other.points[e],b=other.points[(e+1)%3],inward=normal.clone().cross(b.clone().sub(a)).normalize(),yes=[],no=[];
          for(let j=0;j<inside.length;j++){
            const p=inside[j],q=inside[(j+1)%inside.length],dp=p.clone().sub(a).dot(inward),dq=q.clone().sub(a).dot(inward);
            (dp>=0?yes:no).push(p);
            if((dp>=0)!==(dq>=0)){const v=p.clone().lerp(q,dp/(dp-dq));yes.push(v);no.push(v);}
          }
          if(no.length>=3)remaining.push(no);inside=yes;
        }
      }fragments=remaining;if(!fragments.length)break;
    }
    const vertices=[];for(const polygon of fragments)for(let i=1;i<polygon.length-1;i++){
      if(polygon[i].clone().sub(polygon[0]).cross(polygon[i+1].clone().sub(polygon[0])).length()<1e-8)continue;
      vertices.push(...polygon[0].toArray(),...polygon[i].toArray(),...polygon[i+1].toArray());
    }
    if(vertices.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geo.computeVertexNormals();emit(geo,cap.material,new THREE.Matrix4());}
  }
  // Merge by material: façade detail should not add hundreds of draw calls.
  for(const [material,parts] of batches){const merged=new THREE.BufferGeometry();for(const name of ['position','normal','uv',...(material===foundation?['color']:[])]){const size=parts[0].attributes[name].itemSize,total=parts.reduce((n,p)=>n+p.attributes[name].array.length,0),array=new Float32Array(total);let offset=0;for(const p of parts){array.set(p.attributes[name].array,offset);offset+=p.attributes[name].array.length;}merged.setAttribute(name,new THREE.BufferAttribute(array,size));}merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=!material.userData.groundSurface;mesh.receiveShadow=true;root.add(mesh);parts.forEach(p=>p.dispose());}
  root.userData.setTextures=(enabled: boolean)=>{for(const m of [brick,concrete,stepConcrete,groundConcrete,apronConcrete,foundation,...membraneMaterials]){m.userData.texture??=m.map;m.userData.bumpTexture??=m.bumpMap;m.map=enabled?m.userData.texture:null;m.bumpMap=enabled?m.userData.bumpTexture:null;m.needsUpdate=true;}};
  let disposed=false;
  root.userData.ready=surface.ready;
  root.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    const ownedTextures=new Set<THREE.Texture>(),ownedMaterials=new Set<THREE.Material>();
    for(const mesh of root.children){
      mesh.geometry?.dispose();
      for(const material of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[]){
        ownedMaterials.add(material);
        for(const value of [...Object.values(material),...Object.values(material.userData)])if((value as THREE.Texture | null)?.isTexture&&!sharedTextures.has(value as THREE.Texture))ownedTextures.add(value as THREE.Texture);
      }
    }
    for(const texture of ownedTextures)texture.dispose();
    for(const material of ownedMaterials)material.dispose();
    root.removeFromParent();
  };
  return root;
}
