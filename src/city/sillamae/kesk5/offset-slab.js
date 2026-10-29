import * as THREE from 'three';

// Convex clipping keeps roof-junction solids inside the retained outline and
// removes their overlap with existing parapets. No epsilon-lifted top patches.
function signedArea(p){return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;}
function halfPlane(p,a,b,inside=true){
 const cross=q=>(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),out=[];
 for(let i=0;i<p.length;i++){const s=p[i],e=p[(i+1)%p.length],ds=cross(s),de=cross(e),si=inside?ds>=-1e-9:ds<=1e-9,ei=inside?de>=-1e-9:de<=1e-9;
  if(si)out.push(s);if(si!==ei){const t=ds/(ds-de);out.push([s[0]+t*(e[0]-s[0]),s[1]+t*(e[1]-s[1])]);}}
 const clean=out.filter((a,i)=>!i||Math.hypot(a[0]-out[i-1][0],a[1]-out[i-1][1])>1e-8);
 if(clean.length>1&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-8)clean.pop();
 return clean.length>=3&&Math.abs(signedArea(clean))>1e-8?clean:[];
}
function ccw(p){return signedArea(p)<0?[...p].reverse():p;}
function intersection(p,clip){clip=ccw(clip);for(let i=0;i<clip.length&&p.length;i++)p=halfPlane(p,clip[i],clip[(i+1)%clip.length]);return p;}
function subtract(p,clip){clip=ccw(clip);const result=[];for(let i=0;i<clip.length&&p.length;i++){const outside=halfPlane(p,clip[i],clip[(i+1)%clip.length],false);if(outside.length)result.push(outside);p=halfPlane(p,clip[i],clip[(i+1)%clip.length]);}return result;}
function convexHull(points){const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const chain=ps=>{const h=[];for(const p of ps){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=1e-9)h.pop();h.push(p);}return h.slice(0,-1);};return [...chain(sorted),...chain([...sorted].reverse())];}

export function fitOrthogonalOutline(source){
  if(source.length<4||source.length%2||source.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid alternating orthogonal outline');
  let c=0,s=0;
  for(let i=0;i<source.length;i+=2){const a=source[i],b=source[(i+1)%source.length],x=b[0]-a[0],z=b[1]-a[1];c+=x*x-z*z;s+=2*x*z;}
  const angle=Math.atan2(s,c)/2,u=[Math.cos(angle),Math.sin(angle)],v=[-u[1],u[0]];
  const lines=source.map((a,i)=>{const b=source[(i+1)%source.length],n=i%2?u:v;return ((a[0]+b[0])*n[0]+(a[1]+b[1])*n[1])/2;});
  const points=source.map((_,i)=>{const prev=(i+source.length-1)%source.length,x=lines[i%2?i:prev],z=lines[i%2?prev:i];return [x*u[0]+z*v[0],x*u[1]+z*v[1]];});
  return {angle,points,maximumMovement:Math.max(...points.map((p,i)=>Math.hypot(p[0]-source[i][0],p[1]-source[i][1])))};
}

export function createOffsetSlabStudy(spec){
  if(spec.stage!=='plain-shape')throw Error('Only plain-shape studies supported by this version');
  if(spec.windowColumnWidths && (spec.windowColumnWidths.length!==spec.windowColumns.length || spec.windowColumnWidths.some(w=>!Number.isFinite(w)||w<=0)))throw Error('Invalid window column widths');
  const fit=fitOrthogonalOutline(spec.footprint),root=new THREE.Group();
  const g=fit.points.map(p=>{const x=p[0]-spec.origin[0],z=p[1]-spec.origin[1];return [x*Math.cos(fit.angle)+z*Math.sin(fit.angle),-x*Math.sin(fit.angle)+z*Math.cos(fit.angle)];});
  const importedLocal=g.map(p=>[...p]);
  // Reference-led section alignment is separate from rounding-only fitting.
  // Preserve original coordinates; retain unequal section widths and setbacks.
  for(const corners of spec.sectionBoundaryGroups||[]){
    if(corners.length!==4||!corners.every(i=>Number.isInteger(i)&&i>=0&&i<g.length))throw Error('Invalid section boundary group');
    const x=corners.reduce((s,i)=>s+importedLocal[i][0],0)/corners.length;
    for(const [j,i] of corners.entries())g[i][0]=x-(spec.connectedWallFaces&&j>=2?spec.wallThickness:0);
  }
  const edgeThickness=spec.roofEdgeThickness??.18;
  if(!(edgeThickness>0&&Number.isFinite(edgeThickness)))throw Error('Invalid roof edge thickness');
  const relief=spec.facadeRelief;
  if(relief&&(!['edgeWidth','edgeProjection','jambWidth','jambProjection','headHeight'].every(k=>Number.isFinite(relief[k])&&relief[k]>0)||!Number.isFinite(relief.baseDatum)||relief.baseDatum>0))throw Error('Invalid facade relief');
  const materials={frame:new THREE.MeshStandardMaterial({color:0xdddcd5,roughness:1}),wall:new THREE.MeshStandardMaterial({color:0xd5d1c8,roughness:1}),end:new THREE.MeshStandardMaterial({color:0xbdb7ac,roughness:1}),roof:new THREE.MeshStandardMaterial({color:0x92948e,roughness:1}),glass:new THREE.MeshStandardMaterial({color:0x6b7d82,roughness:.8}),base:new THREE.MeshStandardMaterial({color:0xb0b0a6,roughness:1})};
  const audit={lightwells:[],projections:[],openings:[],canopies:[],roofs:[],vents:[],roofDividers:[],facadeEdges:spec.facades,fit,localFootprint:g,importedLocal,sectionAlignmentMovement:Math.max(...g.map((p,i)=>Math.hypot(p[0]-importedLocal[i][0],p[1]-importedLocal[i][1]))),roofEdgeThickness:edgeThickness};
  function box(x,y,z,w,h,d,m,label){if(!(w>0&&h>0&&d>0))throw Error('Invalid solid '+label);const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),materials[m]);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=label;root.add(mesh);return mesh;}
  const area=g.reduce((a,p,i)=>{const q=g[(i+1)%g.length];return a+p[0]*q[1]-q[0]*p[1];},0);
  function frame(i){const a=g[i],b=g[(i+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=area<0?[-u[1],u[0]]:[u[1],-u[0]];
    return {a,b,L,u,n,solid(x,y,w,h,depth,offset,m,label){const mesh=box(a[0]+u[0]*(x+w/2)+n[0]*offset,y+h/2,a[1]+u[1]*(x+w/2)+n[1]*offset,w,h,depth,m,label);mesh.rotation.y=-Math.atan2(u[1],u[0]);
      // Miter the inward edge of every shell strip. Butt-ended boxes placed a
      // coplanar cap over the adjoining facade and produced dashed seams.
      if(label.startsWith('wall-')||(label.startsWith('parapet-')&&!label.startsWith('parapet-rear-'))){
        if(offset+depth/2>1e-8&&offset-depth/2<0){
          // A projected wall needs a vertex row at the original facade plane:
          // only its inward thickness is mitered; the exposed return is square.
          mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(w,h,depth,1,1,2);
          const positions=mesh.geometry.attributes.position;for(let k=0;k<positions.count;k++)if(Math.abs(positions.getZ(k))<1e-8)positions.setZ(k,area<0?-offset:offset);
        }
        const prev=g[(i+g.length-1)%g.length],next=g[(i+2)%g.length];
        const normal=(p,q)=>{const len=Math.hypot(q[0]-p[0],q[1]-p[1]),sign=area<0?-1:1;return [sign*(q[1]-p[1])/len,-sign*(q[0]-p[0])/len];};
        const pn=normal(prev,a),nn=normal(b,next),pos=mesh.geometry.attributes.position;
        for(let k=0;k<pos.count;k++){const px=pos.getX(k),pz=pos.getZ(k),inset=Math.max(0,(area<0?-pz:pz)-offset);
          if(Math.abs(x)<1e-7&&px<0)pos.setX(k,px-(pn[0]*u[0]+pn[1]*u[1])*inset);
          if(Math.abs(x+w-L)<1e-7&&px>0)pos.setX(k,px-(nn[0]*u[0]+nn[1]*u[1])*inset);
        }pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
        if(offset+depth/2>1e-8&&offset-depth/2<0){const flat=mesh.geometry.toNonIndexed();mesh.geometry.dispose();mesh.geometry=flat;mesh.geometry.computeVertexNormals();}
      }
      return mesh;}};}
  function faceWithOpenings(i,holes,type){
    const f=frame(i),facade=spec.facades.find(v=>v.edge===i),r=facade&&relief?(facade.type==='loggia'?{...relief,edgeProjection:spec.rearEdgeProjection??relief.edgeProjection}:relief):null,sections=[];
    const ends=facade?.projectingEnds??['start','end'];
    const stair=holes.find(h=>h.kind==='stair');
    if(r){
      const top=spec.roofDatum+(spec.sideParapetHeight??spec.parapetHeight),head=stair?stair.y+stair.h:null;
      for(const end of ends)sections.push({id:'edge-'+end,x:end==='start'?0:f.L-r.edgeWidth,w:r.edgeWidth,top,depth:r.edgeProjection});
      if(stair)sections.push(
        {id:'stair-left',x:stair.x-r.jambWidth,w:r.jambWidth,top:head+r.headHeight,depth:r.jambProjection},
        {id:'stair-right',x:stair.x+stair.w,w:r.jambWidth,top:head+r.headHeight,depth:r.jambProjection},
        {id:'stair-head',x:stair.x,w:stair.w,bottom:head,top:head+r.headHeight,depth:r.jambProjection});
      audit.projections.push(...sections.map(p=>({edge:i,...p,bottom:p.bottom??r.baseDatum})));
    }
    const ys=[spec.basement?.wallBase??(r?r.baseDatum:0),spec.roofDatum,...holes.flatMap(h=>[h.y,h.y+h.h]),...sections.flatMap(p=>[p.bottom??(r?r.baseDatum:0),Math.min(p.top,spec.roofDatum)])].sort((a,b)=>a-b).filter((x,i,a)=>!i||Math.abs(x-a[i-1])>1e-8);
    // Split the owning wall at every depth breakpoint. Projecting pieces replace
    // shell strips; no flat front face is left hidden behind an applied patch.
    function wallSpan(x,y,w,h){
      const cuts=[x,x+w,...sections.flatMap(p=>[p.x,p.x+p.w]).filter(v=>v>x+1e-8&&v<x+w-1e-8)].sort((a,b)=>a-b);
      for(let j=1;j<cuts.length;j++){const lo=cuts[j-1],hi=cuts[j];if(hi-lo<1e-8)continue;
        const p=sections.find(p=>(lo+hi)/2>p.x-1e-8&&(lo+hi)/2<p.x+p.w+1e-8&&y+h/2>=(p.bottom??r.baseDatum)&&y+h/2<p.top),d=p?.depth??0;
        const returnWall=false; // The adjoining transverse wall owns the return; no extra strip on the balcony face.
        const upperSetback=facade?.type==='loggia'&&!p&&!returnWall?spec.loggiaDepth:0;
        const thickness=returnWall?spec.loggiaDepth+spec.wallThickness:spec.wallThickness+d;
        const offset=returnWall?-thickness/2:(d-spec.wallThickness)/2-upperSetback;
        const wall=f.solid(lo,y,hi-lo,h,thickness,offset,p||returnWall?'end':type,'wall-'+i);
        // The roof membrane owns this covered top. A coplanar wall cap causes
        // visible crawling seams along the set-back roof edge.
        if(upperSetback>0&&Math.abs(y+h-spec.roofDatum)<1e-7){
          const geom=wall.geometry,pos=geom.attributes.position,index=geom.index,kept=[];
          for(let k=0;k<index.count;k+=3){const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)];if(!ids.every(v=>Math.abs(pos.getY(v)-h/2)<1e-6))kept.push(...ids);}
          geom.setIndex(kept);geom.clearGroups();
        }
      }
    }
    for(let k=1;k<ys.length;k++){const lo=ys[k-1],hi=ys[k],spans=holes.filter(h=>h.y<hi-1e-8&&h.y+h.h>lo+1e-8).sort((a,b)=>a.x-b.x);let x=0;for(const h of spans){if(h.x>x)wallSpan(x,lo,h.x-x,hi-lo);x=Math.max(x,h.x+h.w);}if(x<f.L)wallSpan(x,lo,f.L-x,hi-lo);}
    if(facade?.type==='loggia'&&!ends.includes('end'))f.solid(f.L,spec.basement?.wallBase??0,spec.wallThickness,spec.roofDatum-(spec.basement?.wallBase??0),spec.loggiaDepth,-spec.loggiaDepth/2,'end','shared-return-'+i);
    for(const h of holes){audit.openings.push({edge:i,...h});const d=h.kind==='loggia'?spec.loggiaDepth:h.kind==='foundation-recess'?spec.foundationRecess.depth:.22;
      if(h.kind!=='loggia'&&h.kind!=='foundation-recess')f.solid(h.x,h.y,h.w,h.h,.06,-d-.03,'glass','backing-'+i+'-'+h.kind);
      if(h.kind==='foundation-recess'){
        for(const x of [h.x])f.solid(x,h.y,.12,h.h,d,-d/2,'base','foundation-recess-cheek');
        const wy=.18,wh=.43,ww=.75,centres=[.2,.5,.8].map(v=>h.x+h.w*v),label='backing-'+i+'-foundation-recess';
        f.solid(h.x,h.y,h.w,wy-h.y,spec.wallThickness,-d-spec.wallThickness/2,'base',label);
        f.solid(h.x,wy+wh,h.w,h.y+h.h-wy-wh,spec.wallThickness,-d-spec.wallThickness/2,'base',label);
        let cursor=h.x;for(const c of centres){const left=c-ww/2;f.solid(cursor,wy,left-cursor,wh,spec.wallThickness,-d-spec.wallThickness/2,'base',label);f.solid(left,wy,ww,wh,.04,-d-.12,'glass','rear-basement-window');cursor=left+ww;}
        f.solid(cursor,wy,h.x+h.w-cursor,wh,spec.wallThickness,-d-spec.wallThickness/2,'base',label);
      }
      if(h.kind==='basement'){
        const q=spec.basement,wx=h.x-q.wellMargin-q.wellWall,ww=h.w+2*(q.wellMargin+q.wellWall),depth=q.wellDepth+q.wellWall,fy=q.wellFloor;
        for(const x of [wx,wx+ww-q.wellWall])f.solid(x,fy,q.wellWall,q.wellRim-fy,depth,depth/2,'base','lightwell-cheek');
        f.solid(wx+q.wellWall,fy,ww-2*q.wellWall,q.wellRim-fy,q.wellWall,q.wellDepth+q.wellWall/2,'base','lightwell-front');
        f.solid(wx,fy-.10,ww,.10,depth,depth/2,'base','lightwell-floor');
        const corners=[[wx,0],[wx+ww,0],[wx+ww,depth],[wx,depth]].map(([x,z])=>[f.a[0]+f.u[0]*x+f.n[0]*z,f.a[1]+f.u[1]*x+f.n[1]*z]);
        audit.lightwells.push({edge:i,window:h.id,corners,floor:fy,ground:-.015});
      }
      if(h.kind==='loggia'){
        const cfg=spec.rearWindows,wy=h.y+(h.floor===spec.floors?(spec.topRearWindowBottomOffset??cfg.bottomOffset):cfg.bottomOffset),wh=cfg.height,fw=cfg.frameWidth,centres=cfg.fractions.map(f=>h.x+h.w*f);
        f.solid(h.x,h.y,h.w,.16,d-.12,-(d+.12)/2,'base','loggia-floor');
        const setback=h.floor===spec.floors?(spec.roofBalconySetback??0):0,covered=d-setback;
        if(!(covered>0))throw Error('Invalid balcony roof setback');
        if(h.floor<spec.floors)f.solid(h.x,h.y+h.h-.12,h.w,.12,d-.12,-(d+.12)/2,'base','loggia-ceiling');
        f.solid(h.x,h.y-.30,h.w,spec.loggiaParapet+.30,.12,-.06,'base','loggia-parapet');
        f.solid(h.x,h.y,h.w,wy-h.y,.14,-d-.07,'wall','rear-window-wall');
        f.solid(h.x,wy+wh,h.w,h.y+h.h-(wy+wh),.14,-d-.07,'wall','rear-window-wall');
        let cursor=h.x;for(const [j,x] of centres.entries()){
          const ww=cfg.widths[j],left=x-ww/2;
          if(left>cursor)f.solid(cursor,wy,left-cursor,wh,.14,-d-.07,'wall','rear-window-wall');
          f.solid(left,wy,ww,wh,.04,-d-.12,'glass','rear-window-glass');
          // Frame reveals occupy the full wall depth so oblique light cannot
          // pass between the recessed glass and the window cutout.
          for(const sx of [left,left+ww-fw])f.solid(sx,wy,fw,wh,.14,-d-.07,'frame','rear-window-frame');
          f.solid(left+ww/2-fw/2,wy,fw,wh,.05,-d-.025,'frame','rear-window-frame');
          for(const sy of [wy,wy+wh-fw])f.solid(left+fw,sy,ww-2*fw,fw,.14,-d-.07,'frame','rear-window-frame');
          cursor=left+ww;
        }if(cursor<h.x+h.w)f.solid(cursor,wy,h.x+h.w-cursor,wh,.14,-d-.07,'wall','rear-window-wall');
      }
    }
    if(r){
      const left=ends.includes('start')?r.edgeWidth:0,right=ends.includes('end')?r.edgeWidth:0;
      const roofSetback=facade?.type==='loggia'?(spec.roofBalconySetback??0):0;
      const ledge=roofSetback?spec.rearRoofLedge:null,roofHeight=ledge?.height??spec.parapetHeight,roofWidth=ledge?.thickness??edgeThickness;
      f.solid(left,spec.roofDatum,f.L-left-right,roofHeight,roofWidth,-roofWidth/2-roofSetback,'end',(roofSetback?'parapet-rear-':'parapet-')+i);
      for(const x of ends.map(e=>e==='start'?0:f.L-r.edgeWidth))f.solid(x,spec.roofDatum,r.edgeWidth,spec.sideParapetHeight??spec.parapetHeight,spec.wallThickness+r.edgeProjection,(r.edgeProjection-spec.wallThickness)/2,'end','parapet-'+i);
    }else f.solid(0,spec.roofDatum,f.L,i%2?(spec.sideParapetHeight??spec.parapetHeight):spec.parapetHeight,edgeThickness,-edgeThickness/2,'end','parapet-'+i);
  }
  const used=new Set();
  for(const facade of spec.facades){const f=frame(facade.edge),holes=[];used.add(facade.edge);
    if(facade.type==='entrance'){
      if(spec.basement)for(const [j,fraction] of spec.basement.columns.entries())holes.push({x:f.L*fraction-spec.basement.width/2,y:spec.basement.sill,w:spec.basement.width,h:spec.basement.height,kind:'basement',floor:'B',column:j+1,id:`S${facade.section}-NE-B-W${j+1}`});
      for(let floor=0;floor<spec.floors;floor++)for(const [column,fraction] of spec.windowColumns.entries()){const width=spec.windowColumnWidths?.[column]??spec.windowWidth;holes.push({x:f.L*fraction-width/2,y:spec.baseHeight+floor*spec.floorPitch+spec.windowSill,w:width,h:spec.windowHeight,kind:'window',floor:floor+1,column:column+1,id:`S${facade.section}-NE-L${floor+1}-W${column+1}`});}
      holes.push({x:f.L/2-spec.stairWidth/2,y:spec.entryHeight+.16,w:spec.stairWidth,h:spec.roofDatum-spec.entryHeight-.55,kind:'stair'});
      holes.push({x:f.L/2-spec.doorWidth/2,y:0,w:spec.doorWidth,h:spec.entryHeight,kind:'entrance'});
      f.solid(f.L/2-spec.canopyWidth/2,spec.entryHeight,spec.canopyWidth,.14,spec.canopyDepth,spec.canopyDepth/2-.04,'roof','canopy');
      const landingWidth=spec.landingWidth??spec.canopyWidth;
      f.solid(f.L/2-landingWidth/2,0,landingWidth,.15,spec.canopyDepth,spec.canopyDepth/2-.04,'base','landing');
      audit.canopies.push({edge:facade.edge,width:spec.canopyWidth,depth:spec.canopyDepth});
    }else if(facade.type==='loggia'){if(spec.foundationRecess)holes.push({x:spec.foundationRecess.pierWidth,y:spec.basement?.wallBase??-.05,w:f.L-spec.foundationRecess.pierWidth-(facade.projectingEnds?.includes('end')?spec.foundationRecess.pierWidth:0),h:(spec.loggiaBaseHeight??spec.baseHeight)-(spec.basement?.wallBase??-.05),kind:'foundation-recess'});const start=facade.projectingEnds?.includes('start')?(relief?.edgeWidth??.26):.26,end=facade.projectingEnds?.includes('end')?(relief?.edgeWidth??.38):0;const rearBase=spec.loggiaBaseHeight??spec.baseHeight,rearPitch=(spec.roofDatum-rearBase)/spec.floors;for(let floor=0;floor<spec.floors;floor++)holes.push({x:start,y:rearBase+floor*rearPitch,w:f.L-start-end,h:rearPitch-.18,kind:'loggia',floor:floor+1});}
    faceWithOpenings(facade.edge,holes,'wall');
  }
  for(let i=0;i<g.length;i++)if(!used.has(i))faceWithOpenings(i,[],'end');
  const roofG=g.map((p,i)=>[p[0],p[1]-(i>=8?(spec.roofBalconySetback??0):0)]);
  // Roof top and underside supply a shadow-casting underside. Perimeter wall
  // faces already close the edges, so exclude coincident vertical slab faces.
  const shape=new THREE.Shape(roofG.map(p=>new THREE.Vector2(p[0],-p[1]))),geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(0,spec.roofDatum-.12,0);
  {const normal=geo.attributes.normal,keep=[];for(let i=0;i<normal.count;i+=3)if(Math.abs(normal.getY(i))>.5)keep.push(i,i+1,i+2);geo.setIndex(keep);geo.clearGroups();}
  const roof=new THREE.Mesh(geo,materials.roof);roof.name='roof';roof.castShadow=true;roof.receiveShadow=true;root.add(roof);audit.roofs.push({datum:spec.roofDatum,continuousOutline:true});
  root.updateMatrixWorld(true);
  const parapetPlans=root.children.filter(o=>o.name.startsWith('parapet-')).map(o=>{const p=o.geometry.attributes.position,points=[];let top=-Infinity;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);points.push([v.x,v.z]);top=Math.max(top,v.y);}return {plan:convexHull(points),height:top-spec.roofDatum};});
  // Dividers follow the full structural footprint even where the main roof is
  // set back from the balcony front; they are not clipped to the roof deck.
  const fullRoofShape=new THREE.Shape(g.map(p=>new THREE.Vector2(p[0],-p[1]))),dividerGeo=new THREE.ShapeGeometry(fullRoofShape);dividerGeo.rotateX(-Math.PI/2);
  const roofTriangles=[],pos=dividerGeo.attributes.position,idx=dividerGeo.index;
  for(let i=0;i<(idx?.count??pos.count);i+=3)roofTriangles.push([0,1,2].map(j=>{const k=idx?idx.getX(i+j):i+j;return [pos.getX(k),pos.getZ(k)];}));
  for(const d of spec.roofDividers||[]){
    if(Math.abs(d.width-edgeThickness)>1e-9)throw Error('Divider must match roof edge thickness');
    if(!d.id||![d.fromCorner,d.toCorner].every(i=>Number.isInteger(i)&&i>=0&&i<g.length)||!(d.width>0&&Number.isFinite(d.width))||!(d.height>0&&d.height<=(spec.sideParapetHeight??spec.parapetHeight)))throw Error('Invalid roof divider');
    const a=[...g[d.fromCorner]],b=[...g[d.toCorner]];
    if(spec.connectedWallFaces){a[0]-=d.width/2;b[0]=a[0];}
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-6)throw Error('Invalid roof divider length');
    const n=[-(b[1]-a[1])/length*d.width/2,(b[0]-a[0])/length*d.width/2],strip=ccw([[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]]);
    const levels=[0,d.height,...parapetPlans.map(p=>p.height).filter(h=>h>1e-7&&h<d.height-1e-7)].sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-7),pieces=[];let topArea=0;
    for(let layer=1;layer<levels.length;layer++){
      const bottom=levels[layer-1],top=levels[layer];let parts=roofTriangles.map(t=>intersection(strip,t)).filter(p=>p.length);
      // Clip each height layer against the solids present at that height. The
      // raised divider continues over lower front coping without duplicate caps.
      for(const p of parapetPlans.filter(p=>p.height>(bottom+top)/2))parts=parts.flatMap(part=>subtract(part,p.plan));
      if(!parts.length)throw Error('Roof divider has no exposed area');
      parts.forEach(p=>{const shape=new THREE.Shape(p.map(v=>new THREE.Vector2(v[0],-v[1]))),geom=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1});geom.rotateX(-Math.PI/2);geom.translate(0,spec.roofDatum+bottom,0);const mesh=new THREE.Mesh(geom,materials.end);mesh.name=`roof-divider-${d.id}-${pieces.length}`;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);pieces.push(p);});
      topArea=parts.reduce((s,p)=>s+Math.abs(signedArea(p)),0);
    }
    audit.roofDividers.push({...d,start:a,end:b,length,pieces,planArea:topArea,skewDegrees:Math.atan2(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*180/Math.PI});
  }
  dividerGeo.dispose();
  for(const facade of spec.facades.filter(f=>f.type==='entrance')){const f=frame(facade.edge);for(const [fraction,depth] of spec.roofVentLayout){const x=f.L*fraction,w=spec.ventWidth,d=spec.ventDepth;f.solid(x-w/2,spec.roofDatum,w,spec.ventHeight,d,-depth,'end','roof-vent');audit.vents.push({edge:facade.edge,fraction,depth});}}
  root.userData.audit=audit;root.userData.stage='plain-shape';root.userData.dispose=()=>{root.traverse(o=>o.geometry?.dispose());Object.values(materials).forEach(m=>m.dispose());};return root;
}

export function createStudyGroundGeometry(audit){
 const shape=new THREE.Shape([new THREE.Vector2(-200,-200),new THREE.Vector2(200,-200),new THREE.Vector2(200,200),new THREE.Vector2(-200,200)]);
 for(const well of audit.lightwells||[])shape.holes.push(new THREE.Path(well.corners.map(p=>new THREE.Vector2(p[0],-p[1]))));
 const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);return geo;
}
