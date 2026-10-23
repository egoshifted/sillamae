import * as THREE from 'three';

// Shared stepped brick apartment design, established from Kesk 1.
// Requires a compatible, reference-checked footprint edge layout; never apply by address alone.
// Local Y is height above the foundation. Site-specific ground carving stays with each building.
export function addSteppedApartment(scene, building, terrain, design) {
  const root=new THREE.Group();root.position.set(0,12.8-19.3,0);scene.add(root);
  const batches=new Map(),g=building.g;
  const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
  const brick=mat('#c18460'),concrete=mat('#95958e'),trim=mat('#dddcd4'),glass=mat('#65818a',.3),dark=mat('#323b3b'),wood=mat('#6c4933'),metal=mat('#575c59'),roof=mat('#464b48'),redWood=mat('#834c38'),green=mat('#4d6938'),flower=mat('#eee9ca');
  function texture(type){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');let seed=42;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    x.fillStyle=type==='brick'?'#aa9b88':'#c4c4bd';x.fillRect(0,0,512,256);
    if(type==='brick')for(let row=0;row<8;row++)for(let col=-1;col<5;col++){const a=170+random()*55;x.fillStyle=`rgb(${a},${a-12},${a-23})`;x.fillRect(col*128+(row%2)*64+2,row*32+2,124,28);}
    for(let i=0;i<18000;i++){const a=110+random()*145;x.fillStyle=`rgba(${a},${a},${a},${type==='brick'?.17:.32})`;x.fillRect(random()*512,random()*256,1+random()*2,1+random()*2);}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  brick.map=texture('brick');brick.bumpMap=brick.map;brick.bumpScale=.018;concrete.map=texture('concrete');concrete.bumpMap=concrete.map;concrete.bumpScale=.025;
  function emit(geo,m,matrix){geo=geo.index?geo.toNonIndexed():geo.clone();geo.applyMatrix4(matrix);if(m===brick||m===concrete){const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<p.count;i++){const horizontal=Math.abs(n.getY(i))>.5;uv.setXY(i,(horizontal?p.getX(i):Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/(m===brick?1:.8),(horizontal?p.getZ(i):p.getY(i))/(m===brick?.52:.8));}}if(!batches.has(m))batches.set(m,[]);batches.get(m).push(geo);}
  const dummy=new THREE.Object3D();
  function box(x,y,z,w,h,d,m,angle=0){dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();emit(new THREE.BoxGeometry(w,h,d),m,dummy.matrix);}
  function edge(index){const a=g[index],b=g[(index+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=new THREE.Vector3((b[0]-a[0])/L,0,(b[1]-a[1])/L);let n=new THREE.Vector3(-u.z,0,u.x);const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(n.x*(mid[0]-building.c[0])+n.z*(mid[1]-building.c[1])<0)n.negate();
    // Recess walls need the polygon winding, rather than the centroid heuristic.
    let area=0;for(let i=0;i<g.length;i++){const p=g[i],q=g[(i+1)%g.length];area+=p[0]*q[1]-q[0]*p[1];}n.set(u.z,0,-u.x).multiplyScalar(Math.sign(area));
    const angle=Math.atan2(-u.z,u.x),at=(x,y,d=0)=>new THREE.Vector3(a[0]-750+u.x*x+n.x*d,y,a[1]-760+u.z*x+n.z*d);
    const block=(x,y,w,h,d,m,offset=0)=>{const p=at(x+w/2,y+h/2,offset+d/2);box(p.x,p.y,p.z,w,h,d,m,angle);};return {L,at,block,angle,n};
  }
  function beam(a,b,r,m){const direction=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());dummy.updateMatrix();emit(new THREE.CylinderGeometry(r,r,direction.length(),6),m,dummy.matrix);}
  function window(p,x,y,w=1.3,h=1.45,frame=trim,curtains=false){p.block(x-.08,y-.08,w+.16,h+.16,.045,dark,.015);p.block(x,y,w,h,.045,glass,.065);if(curtains)for(let j=0;j<8;j++)p.block(x+j*w/8,y,.055,h,.015,j%2?trim:concrete,.117);for(const xx of [x-.06,x+w/2-.025,x+w])p.block(xx,y-.06,.06,h+.12,.07,frame,.12);for(const yy of [y-.06,y+h])p.block(x-.06,yy,w+.12,.06,.07,frame,.12);p.block(x-.16,y+h+.12,w+.32,.19,.16,concrete,.02);p.block(x-.1,y-.15,w+.2,.07,.24,concrete,.02);}
  const height=design.height;
  // The main walls are single flat surfaces, avoiding overlapping surveyed panels.
  for(let i=0;i<g.length;i++){const p=edge(i);p.block(0,0,p.L,1.8,.13,concrete,[2,9,11,13,18].includes(i)?-1.13:-.13);p.block(0,1.8,p.L,height-1.8,.13,brick,[2,9,11,13,18].includes(i)?-1.05:-.13);p.block(0,height-.8,p.L,.8,.28,[2,9,11,13,18].includes(i)?trim:brick,-.14);p.block(0,height-.06,p.L,.08,.32,roof,-.16);}
  const shape=new THREE.Shape(g.map(p=>new THREE.Vector2(p[0]-750,-(p[1]-760))));const cap=new THREE.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(0,height-.22,0);emit(cap,roof,new THREE.Matrix4());
  // Simple square lift overrun centred on the roof, as requested.
  const shaftAngle=Math.atan2(g[2][1]-g[1][1],g[2][0]-g[1][0]);
  const shaft=[[-2.7,-2.7],[2.7,-2.7],[2.7,2.7],[-2.7,2.7]].map(([x,z])=>[building.c[0]+x*Math.cos(shaftAngle)-z*Math.sin(shaftAngle),building.c[1]+x*Math.sin(shaftAngle)+z*Math.cos(shaftAngle)]);
  for(let i=0;i<shaft.length;i++){const a=shaft[i],b=shaft[(i+1)%shaft.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(-dz,dx);
    box((a[0]+b[0])/2-750,29.55,(a[1]+b[1])/2-760,length,3.3,.09,trim,angle);
    for(let x=.04;x<length;x+=.11)box(a[0]+dx*x/length-750,29.55,a[1]+dz*x/length-760,.028,3.3,.14,concrete,angle);
    box((a[0]+b[0])/2-750,31.23,(a[1]+b[1])/2-760,length,.1,.18,roof,angle);
  }
  const shaftCap=new THREE.ShapeGeometry(new THREE.Shape(shaft.map(p=>new THREE.Vector2(p[0]-750,-(p[1]-760)))));shaftCap.rotateX(-Math.PI/2);shaftCap.translate(0,31.2,0);emit(shaftCap,roof,new THREE.Matrix4());

  const balconyEdges=design.balconyEdges;
  for(let i=0;i<g.length;i++){const p=edge(i),L=p.L;
    if(balconyEdges.includes(i)){
      if(i===18)for(let x=.08;x<L-.05;x+=.09)p.block(x,height-.8,.025,.74,.035,concrete,.16);
      // Shaded open base, with the first enclosed balcony raised above it.
      p.block(.12,0,L-.24,1.8,.04,[2,9,11,13,18].includes(i)?concrete:dark,[2,9,11,13,18].includes(i)?-.98:.015);
      for(const x of [0,L-.18])p.block(x,0,.18,1.8,[2,9,11,13].includes(i)?.8:i===18?1:.32,concrete,[2,9,11,13,18].includes(i)?-1:.015);
      for(let r=0;r<design.floors;r++){const y=1.9+r*design.floorPitch,brown=(i===2&&r===1)||(i===11&&r===1),frame=brown?wood:trim;
        p.block(.05,y,L-.1,1.15,.16,trim,.05);
        for(let x=.08;x<L-.05;x+=.09)p.block(x,y,.025,1.15,.035,concrete,.21);
        const rearBrown=i===18&&design.rearBrownFloors.includes(r),balconyFrame=rearBrown?wood:frame;
        const panes= brown||rearBrown?6:5,w=(L-.3)/panes,open=design.openBalconies.some(([edge,floor])=>edge===i&&floor===r);
        if(open){
          // Rear balcony door and short transom windows, behind an open railing.
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
          for(let j=0;j<panes;j++){p.block(.15+j*w,y+1.22,w-.04,1.4,.04,glass,.12);if(r===0||brown)for(let k=0;k<3;k++)p.block(.18+j*w+k*w/4,y+1.23,.035,1.43,.014,r===0?trim:green,.17);p.block(.12+j*w,y+1.2,.055,1.48,.1,balconyFrame,.19);}
          for(const yy of [y+1.17,y+2.65])p.block(.08,yy,L-.16,.07,.1,balconyFrame,.19);
        }
        p.block(.02,y+2.8,L-.04,.1,1.25,concrete,-1.0);
        if(i===13&&r===0){
          // White decorative security grille across the lower left loggia.
          for(let bay=0;bay<3;bay++){const cx=.15+(bay+.5)*(L-.3)/3,cy=y+1.9;
            for(let spoke=0;spoke<12;spoke++){const a=spoke*Math.PI/6;beam(p.at(cx,cy,.34),p.at(cx+Math.cos(a)*(L-.3)/6,cy+Math.sin(a)*.64,.34),.014,trim);}
            for(const xx of [cx-(L-.3)/6,cx+(L-.3)/6])beam(p.at(xx,y+1.2,.34),p.at(xx,y+2.65,.34),.018,trim);
          }
        }
      }
    }
    for(let r=0;r<9;r++){const y=2.8+r*2.85;
      if(i===14)window(p,L*.76,y);
      if(i===16&&r>0)window(p,(L-1.65)/2,y,1.65);
      if(i===19)window(p,L*.83,y);
      if(i===4)window(p,L*.32,y,L*.37,1.45,r===2?wood:trim,r===2);
      if(i===6&&r>0)window(p,(L-2.2)/2,y-.15,2.2,1.45);
      if(i===8)window(p,L*.1,y); // Single column: the two spurious lower windows are removed.
    }
    if([4,8,14,19].includes(i))window(p,i===8?L*.1:i===4?L*.32:i===14?L*.76:L*.65,.35,1.2,.8);
    if(i===18)window({...p,block:(x,y,w,h,d,m,offset=0)=>p.block(x,y,w,h,d,m,offset-1)},(L-1.25)/2,.35,1.25,.8);
  }
  // Main entrance: raised landing, five concrete treads, canopy and steel handrails.
  const entry=edge(6),ew=entry.L*.86,ex=entry.L*.07;
  entry.block(ex,.95,ew,2.3,.07,dark,.03);entry.block(ex+ew*.57,1.02,ew*.38,2.12,.08,wood,.12);entry.block(ex+ew*.8,1.9,.05,.22,.07,trim,.21);
  const doorX=ex+ew*.57,doorW=ew*.38;
  entry.block(doorX+doorW*.45,1.8,doorW*.22,1.05,.025,dark,.21);
  entry.block(doorX-.27,2.05,.18,.23,.065,dark,.13);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)entry.block(doorX-.25+col*.045,2.08+row*.04,.02,.02,.015,trim,.2);
  entry.block(doorX-.3,3.2,doorW+.6,.17,.13,concrete,.03);
  entry.block(ex+ew*.48,3.25,.24,.08,.24,trim,.5);
  entry.block(ex-.18,3.35,ew+.36,.18,1.4,concrete,.02);entry.block(ex-.18,3.53,ew+.36,.16,1.4,roof,.02);
  entry.block(ex,.05,ew,.9,1.1,concrete,.02);
  for(let j=0;j<5;j++)entry.block(ex,.02,ew,.9-j*.18,.32,concrete,1.12+j*.32);
  for(const x of [ex+.06,ex+ew-.06]){for(const [d,y] of [[1.1,.95],[2.6,.08]])beam(entry.at(x,y,d),entry.at(x,y+.95,d),.025,metal);beam(entry.at(x,1.9,1.1),entry.at(x,1.03,2.6),.025,metal);}
  // Northern utility annex and low entrance canopy, visible from Kesk Street.
  // September 2023 side view: annex outer face aligns with the tiled access path.
  // About six slab widths are visible; 2.4 m is provisional, not surveyed.
  // This supersedes the misleading rear-view balcony-width comparison.
  const annex=edge(19),pathWidth=design.pathWidth;
  // The tiled access follows the outer wing, not this recessed wall plane.
  const pathOffset=Math.max(...g.map(p=>(p[0]-g[19][0])*annex.n.x+(p[1]-g[19][1])*annex.n.z))+.06;
  const annexDepth=pathOffset+pathWidth;
  root.userData.pathClearance={offset:pathOffset,width:pathWidth,outerWall:Math.max(...g.map(p=>(p[0]-g[19][0])*annex.n.x+(p[1]-g[19][1])*annex.n.z))};
  // August 2024 side views: solid annex reaches the first window column.
  // Its remaining entrance bay is covered by one lower roof extension.
  const annexEndX=annex.L*.83,canopyEnd=annex.L;
  // User's outlined 2024 photograph resolves the apparent tall block:
  // the black roof sits behind a solid parapet about one metre higher.
  const annexMembrane=mat('#242725'),annexRoofY=2.01,parapetTop=annexRoofY+.045+design.annexParapetHeight,parapetThickness=.18;
  annex.block(.05,-1.14,annexEndX-.05,annexRoofY+1.14,annexDepth,concrete,.02);
  annex.block(.05,annexRoofY,annexEndX-.05,.045,annexDepth,annexMembrane,.02);
  // Outer side and far-end return; the entrance end stays open to the canopy.
  annex.block(.05,annexRoofY,annexEndX-.05,parapetTop-annexRoofY,parapetThickness,concrete,annexDepth-parapetThickness+.02);
  annex.block(.05,annexRoofY,parapetThickness,parapetTop-annexRoofY,annexDepth,concrete,.02);
  annex.block(.03,parapetTop,annexEndX-.01,.07,parapetThickness+.06,trim,annexDepth-parapetThickness-.01);
  annex.block(.02,parapetTop,parapetThickness+.06,.07,annexDepth+.06,trim,-.01);
  // Dark waterproof lining turns up the inside of the parapet and wall.
  annex.block(.23,annexRoofY,annexEndX-.23,.22,.025,annexMembrane,annexDepth-parapetThickness-.005);
  annex.block(.23,annexRoofY,.025,.22,annexDepth-parapetThickness-.02,annexMembrane,.02);
  annex.block(.23,annexRoofY,canopyEnd-.23,.22,.025,annexMembrane,.02);
  // June 2012 view exposes the end window, dark grille and broad projecting hood.
  const annexEnd={block:(x,y,w,h,d,m,offset=0)=>{const p=annex.at(annexEndX+offset+d/2,y+h/2,x+w/2);box(p.x,p.y,p.z,w,h,d,m,annex.angle+Math.PI/2);}};
  const aw=1.65,ax=pathOffset+.18;
  window(annexEnd,ax,.35,aw,1.15,wood);
  for(let j=0;j<=7;j++)annexEnd.block(ax+j*aw/7,.35,.025,1.15,.025,metal,.23);
  for(let j=0;j<=4;j++)annexEnd.block(ax,.35+j*1.15/4,aw,.025,.025,metal,.23);
  // Door is on the MAIN BUILDING side wall, perpendicular to the barred window.
  const serviceDoorX=annexEndX+.13,serviceDoorW=canopyEnd-serviceDoorX-.1;
  annex.block(serviceDoorX,-.95,serviceDoorW,2.55,.07,wood,.03);
  annex.block(serviceDoorX+serviceDoorW*.5,-.95,.025,2.55,.025,metal,.105);
  // A single roof over the open bay, joined directly to the solid annex end.
  annex.block(annexEndX,1.85,canopyEnd-annexEndX,.16,annexDepth+.08,concrete,.02);
  annex.block(annexEndX,annexRoofY,canopyEnd-annexEndX,.045,annexDepth+.08,annexMembrane,.02);
  beam(annex.at(canopyEnd-.08,-1,annexDepth-.05),annex.at(canopyEnd-.08,1.85,annexDepth-.05),.035,redWood);
  // Slab-paved side access, with grass-visible joints and bins at the outer edge.
  const pathStart=(g[2][0]-g[19][0])*Math.cos(annex.angle)-(g[2][1]-g[19][1])*Math.sin(annex.angle),pathEnd=27.5,slab=.4;
  for(let x=pathStart;x<pathEnd;x+=slab)for(let col=0;col<6;col++){
    const w=Math.min(slab-.024,pathEnd-x);
    annex.block(x,.025,w,.045,slab-.024,concrete,pathOffset+col*slab);
  }
  // Lower service entrance: paving ends at the wing line, then five treads
  // descend approximately one metre. The ground mesh is cut out below.
  const stairEnd=pathStart-1.75;
  // Continuous floor under the stairs prevents open gaps exposing the water plane.
  annex.block(4.29,-1.14,annex.L-4.29,.14,annexDepth+.04,concrete,-.02);
  annex.block(annex.L-.02,-1.14,pathStart-annex.L+.04,.14,pathWidth+.04,concrete,pathOffset-.02);
  for(let j=0;j<5;j++)annex.block(pathStart-(j+1)*.35,-1.12,.35,1.12-(j+1)*.2,pathWidth,concrete,pathOffset);
  annex.block(4.31,-1.12,pathStart-4.31,1.12,.12,concrete,annexDepth-.12);
  annex.block(4.29,-1.14,annex.L-4.29,1.14,.12,concrete,-.12);
  annex.block(annex.L,-1.14,pathStart-annex.L,1.14,.12,concrete,pathOffset-.12);
  // Guard rail follows the paved edge and the outside of the stairwell.
  for(let x=annexEndX+.1;x<=pathStart;x+=2)beam(annex.at(x,0,annexDepth),annex.at(x,.95,annexDepth),.025,redWood);
  beam(annex.at(annexEndX+.1,.95,annexDepth),annex.at(pathStart,.95,annexDepth),.025,redWood);
  for(let j=0;j<3;j++){
    const x=pathStart+.7+j*.95,d=pathOffset+1.58;
    annex.block(x,.13,.62,.94,.67,dark,d);
    annex.block(x-.035,1.07,.69,.07,.74,metal,d-.035);
    annex.block(x+.04,1.14,.54,.035,.55,dark,d+.04);
    for(const xx of [x+.06,x+.56]){
      beam(annex.at(xx,.14,d+.56),annex.at(xx,.14,d+.69),.105,roof);
      beam(annex.at(xx,.9,d+.7),annex.at(xx,1.05,d+.7),.024,metal);
    }
    beam(annex.at(x+.06,1.05,d+.7),annex.at(x+.56,1.05,d+.7),.024,metal);
  }
  // Rear entrance between the balcony and the solid western wing.
  const rear=edge(16),rx=.12,rw=rear.L-.24;
  rear.block(rx,.85,rw,2.5,.06,dark,.02);rear.block(rx+.16,.9,rw-.32,2.3,.07,wood,.1);
  rear.block(rx-.1,3.4,rw+.2,.17,1.05,concrete,.02);
  rear.block(rx,0,rw,.85,.85,concrete,.02);
  for(let j=0;j<5;j++)rear.block(rx,0,rw,.85-j*.17,.3,concrete,.87+j*.3);
  for(const x of [rx+.04,rx+rw-.04]){beam(rear.at(x,.85,.85),rear.at(x,1.75,.85),.022,redWood);beam(rear.at(x,.05,2.3),rear.at(x,.95,2.3),.022,redWood);beam(rear.at(x,1.75,.85),rear.at(x,.95,2.3),.022,redWood);}
  // Fan-pattern white grille on the lowest rear window.
  const grille=edge(14),gx=grille.L*.76;
  for(let j=0;j<=12;j++){const a=j*Math.PI/24,dx=Math.cos(a),dy=Math.sin(a),length=Math.min(1.17/Math.max(dx,.0001),1.34/Math.max(dy,.0001));beam(grille.at(gx+.08,2.86,.24),grille.at(gx+.08+dx*length,2.86+dy*length,.24),.014,trim);}
  for(const x of [gx,gx+1.3])beam(grille.at(x,2.8,.24),grille.at(x,4.25,.24),.02,trim);
  const signWall=edge(1);
  function plaque(text,x,y,w,h){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f3f2e8';ctx.fillRect(0,0,512,256);ctx.fillStyle='#263130';ctx.font=`bold ${text===design.number?200:105}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,133);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=mat('#ffffff');m.map=t;const right=new THREE.Vector3(signWall.n.z,0,-signWall.n.x),matrix=new THREE.Matrix4().makeBasis(right,new THREE.Vector3(0,1,0),signWall.n);matrix.setPosition(signWall.at(x,y,.16));emit(new THREE.PlaneGeometry(w,h),m,matrix);}
  plaque(design.number,signWall.L-.7,4,.42,.4);plaque(design.street,signWall.L-.7,3.62,.85,.25);
  // Flower box on the third-floor window and a wall-mounted satellite dish.
  const fp=edge(8),fx=fp.L*.1;fp.block(fx,8.5,1.3,.22,.3,wood,.15);
  for(let j=0;j<12;j++){const p=fp.at(fx+.08+j*.1,8.8+.08*Math.sin(j),.36);dummy.position.copy(p);dummy.rotation.set(0,0,0);dummy.updateMatrix();emit(new THREE.IcosahedronGeometry(.095,0),j%3?flower:green,dummy.matrix);}
  const bp=edge(2),dish=bp.at(bp.L-.25,8.6,.65);beam(bp.at(bp.L-.25,8.3,.12),dish,.035,metal);dummy.position.copy(dish);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),bp.n.clone().add(new THREE.Vector3(0,.25,0)).normalize());dummy.scale.set(1,1,.22);dummy.updateMatrix();emit(new THREE.SphereGeometry(.42,16,10),trim,dummy.matrix);dummy.scale.set(1,1,1);
  function bench(p,x,d){for(let j=0;j<5;j++)p.block(x,.45,2,.05,.075,redWood,d+j*.09);for(let j=0;j<6;j++)p.block(x,.57+j*.1,2,.07,.065,redWood,d);for(const xx of [x+.25,x+1.75]){beam(p.at(xx,.05,d+.16),p.at(xx,.48,d+.16),.045,metal);beam(p.at(xx,.43,d+.03),p.at(xx,1.13,d+.03),.035,metal);}}
  bench(edge(8),edge(8).L*.63,4.35);
  const grassBench=edge(8),bx=-5.5;grassBench.block(bx,.47,2,.08,.4,wood,4.35);grassBench.block(bx,.85,2,.28,.07,redWood,4.35);for(const x of [bx+.25,bx+1.75])grassBench.block(x,0,.12,1.12,.17,concrete,4.45);
  // Local parking/access widening. Reference shows parking plus a driving aisle,
  // then a return to the mapped 5 m living street towards Kesk 5.
  if(terrain){
    const asphalt=mat('#83877e');
    const ground=(x,z)=>{const xx=Math.max(0,Math.min(terrain.width-1.001,(x-terrain.origin[0])/terrain.step)),zz=Math.max(0,Math.min(terrain.height-1.001,(z-terrain.origin[1])/terrain.step)),i=Math.floor(xx),j=Math.floor(zz),u=xx-i,v=zz-j,k=j*terrain.width+i,d=terrain.values;return (d[k]*(1-u)*(1-v)+d[k+1]*u*(1-v)+d[k+terrain.width]*(1-u)*v+d[k+terrain.width+1]*u*v)/10-12.8+.12;};
    function quad(points,m){const geo=new THREE.BufferGeometry(),ids=[0,1,2,0,2,3];geo.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>[points[i][0]-750,ground(...points[i]),points[i][1]-760]),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(ids.flatMap(i=>[points[i][0],points[i][1]]),2));geo.computeVertexNormals();emit(geo,m,new THREE.Matrix4());}
    const road=[[232.3,555.5,5],[228.8,564.4,8.4],[218,591.9,8.4],[221.8,601.3,5]];
    for(let i=0;i<road.length-1;i++){const a=road[i],b=road[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len,steps=Math.ceil(len);
      const point=(t,side)=>[a[0]+(b[0]-a[0])*t+nx*(a[2]+(b[2]-a[2])*t)*side/2,a[1]+(b[1]-a[1])*t+nz*(a[2]+(b[2]-a[2])*t)*side/2];
      for(let j=0;j<steps;j++)quad([point(j/steps,-1),point((j+1)/steps,-1),point((j+1)/steps,1),point(j/steps,1)],asphalt);
    }
    const walk=edge(8);for(let x=-8;x<walk.L+2;x+=1){const pts=[[x,4.85],[x+1,4.85],[x+1,6.05],[x,6.05]].map(([u,d])=>{const p=walk.at(u,0,d);return[p.x+750,p.z+760];});quad(pts,concrete);}
  }
  // Merge by material: façade detail should not add hundreds of draw calls.
  for(const [material,parts] of batches){const merged=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const size=parts[0].attributes[name].itemSize,total=parts.reduce((n,p)=>n+p.attributes[name].array.length,0),array=new Float32Array(total);let offset=0;for(const p of parts){array.set(p.attributes[name].array,offset);offset+=p.attributes[name].array.length;}merged.setAttribute(name,new THREE.BufferAttribute(array,size));}merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);parts.forEach(p=>p.dispose());}
  root.userData.setTextures=enabled=>{for(const m of [brick,concrete]){m.userData.texture??=m.map;m.map=enabled?m.userData.texture:null;m.bumpMap=m.map;m.needsUpdate=true;}};
  return root;
}

