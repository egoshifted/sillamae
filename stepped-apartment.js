import * as THREE from 'three';

// Shared stepped brick apartment design, established from Kesk 1.
// Requires a compatible, reference-checked footprint edge layout; never apply by address alone.
// Local Y is height above the foundation. Site-specific ground carving stays with each building.
export function addSteppedApartment(scene, building, terrain, design) {
  const root=new THREE.Group();root.position.set(0,12.8-19.3,0);scene.add(root);
  const batches=new Map(),g=building.g,pendingCaps=[];
  const closedConstructionAudit=design.closedConstructionAudit===true;
  const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness,shadowSide:THREE.DoubleSide});
  const brick=mat('#c18460'),concrete=mat('#95958e'),trim=mat('#dddcd4'),glass=mat('#65818a',.3),dark=mat('#323b3b'),wood=mat('#6c4933'),metal=mat('#575c59'),roof=mat('#464b48'),redWood=mat('#834c38'),green=mat('#4d6938'),flower=mat('#eee9ca');
  const foundation=mat('#aaa99f',1);foundation.userData.foundationRender=true;
  function renderTextures(){
    const canvases=[0,1].map(()=>{const c=document.createElement('canvas');c.width=c.height=512;return c;}),[colour,relief]=canvases.map(c=>c.getContext('2d'));
    const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+17.3)*43758.5453;return n-Math.floor(n);};
    const noise=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),a=x-i,b=y-j,u=a*a*(3-2*a),v=b*b*(3-2*b);return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;};
    // Two-metre roughcast swatch: irregular aggregate over broad wavy trowel ridges.
    for(let y=0;y<512;y+=2)for(let x=0;x<512;x+=2){const warp=noise(x/82,y/82),wave=Math.sin(y*.07+warp*9+Math.sin(x*.025)*2),grain=noise(x/3,y/3),h=112+wave*26+(noise(x/14,y/14)-.5)*65+(grain-.5)*83,c=222+(h-112)*.15;
      colour.fillStyle='rgb('+c+','+(c-1)+','+(c-5)+')';colour.fillRect(x,y,2,2);relief.fillStyle='rgb('+h+','+h+','+h+')';relief.fillRect(x,y,2,2);
    }
    return canvases.map((c,i)=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(i===0)t.colorSpace=THREE.SRGBColorSpace;return t;});
  }
  [foundation.map,foundation.bumpMap]=renderTextures();foundation.bumpScale=.065;
  const sillMetal=mat('#818b8d',.45);sillMetal.metalness=.55;
  const lintelMaterial=mat('#a8aaa3'); // Uniform concrete; no facade texture or bump map.
  const membraneMaterials=new Set([roof]),tire=mat('#464b48');
  brick.color.set('#c8a58a');brick.roughness=1;brick.metalness=0;
  function masonryTextures(){
    const canvases=[0,1].map(()=>{const c=document.createElement('canvas');c.width=c.height=512;return c;}),[colour,relief]=canvases.map(c=>c.getContext('2d'));
    let seed=1943;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const mortar=()=>{colour.fillStyle='#b6c7d6';relief.fillStyle='#666666';};mortar();colour.fillRect(0,0,512,512);relief.fillRect(0,0,512,512);
    for(let row=0;row<12;row++){
      const headers=row%6===0,pitch=headers?32:64,shift=(row%2)*pitch/2;
      for(let col=-1;col<512/pitch+1;col++){
        const x=col*pitch+shift+1+random(),y=row*512/12+1+random()*1.2,w=pitch-2.4-random(),h=512/12-3.5-random()*1.3,v=207+random()*25;
        colour.fillStyle=`rgb(${v},${v-9},${v-15})`;relief.fillStyle=`rgb(${184+random()*14},${184},${184})`;
        colour.fillRect(x,y,w,h);relief.fillRect(x,y,w,h);
        // Chipped edges and occasional raised mortar, shared by colour and relief.
        for(let j=0;j<5;j++){const xx=x+random()*w,yy=j%2?y+h-1:y;const size=1+random()*2.5;mortar();colour.fillRect(xx,yy,size,1+random()*2);relief.fillRect(xx,yy,size,2);}
        if(random()<.45){const xx=x+random()*w;colour.fillStyle='#b6c7d6';relief.fillStyle='#c3c3c3';colour.fillRect(xx,y+h,4+random()*5,2);relief.fillRect(xx,y+h,6,2);}
        if(random()<.22)for(let j=3;j<w-2;j+=3){colour.fillStyle='rgba(90,87,80,.12)';relief.fillStyle='#a0a0a0';colour.fillRect(x+j,y+1,.7,h-2);relief.fillRect(x+j,y+1,.7,h-2);}
      }
    }
    for(let i=0;i<65000;i++){const x=random()*512,y=random()*512,v=80+random()*170;colour.fillStyle=`rgba(${v},${v},${v},.16)`;relief.fillStyle=`rgba(${v},${v},${v},.24)`;colour.fillRect(x,y,1,1);relief.fillRect(x,y,1,1);}
    return canvases.map((c,i)=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(i===0)t.colorSpace=THREE.SRGBColorSpace;return t;});
  }
  function feltTexture(canopy=false){
    const c=document.createElement('canvas'),size=canopy?1024:4096;c.width=c.height=size;const ctx=c.getContext('2d');
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
    // Geometry-only test canvases do not rasterize; the browser review verifies texture fidelity.
    if(!ctx.createImageData)return t;
    const grid=256,field=new Float32Array((grid+1)*(grid+1)*3),pools=canopy?[[.51,.48,.37,.29]]:[[.28,.42,.10,.07],[.72,.77,.07,.115],[.82,.2,.055,.04],[.13,.88,.045,.06],[.55,.13,.11,.035],[.47,.65,.035,.055]];
    for(let gy=0;gy<=grid;gy++)for(let gx=0;gx<=grid;gx++){
      const x=gx/grid*1024,y=gy/grid*1024,mottling=Math.sin(x*.018+Math.sin(y*.023)*1.8)+Math.sin(y*.031+x*.007)+.6*Math.sin(x*.057-y*.019),stain=Math.max(0,mottling-1.05);let pool=0,rim=0;
      for(const [cx,cy,rx,ry] of pools){const dx=(x/1024-cx)/rx,dy=(y/1024-cy)/ry,a=Math.atan2(dy,dx),r=Math.hypot(dx,dy)/(1+.12*Math.sin(3*a+cx*39)+.075*Math.sin(7*a+cy*31)+.04*Math.cos(11*a+cx*17));pool=Math.max(pool,Math.max(0,1-r*r));rim=Math.max(rim,Math.exp(-Math.pow((r-.93)/.055,2)));}
      const v=195+mottling*2-stain*6-pool*(canopy?38:25)+rim*7,k=(gy*(grid+1)+gx)*3;field[k]=v-stain*2+pool*3;field[k+1]=v;field[k+2]=v-stain*7-pool*7;
    }
    // Smooth metre-scale weathering is independent of the 4 mm aggregate pixels.
    const pixels=ctx.createImageData(size,size);let seed=711;const stride=(grid+1)*3,aggregateSide=size/4+1,aggregate=new Float32Array(aggregateSide*aggregateSide);
    for(let i=0;i<aggregate.length;i++){seed=(1664525*seed+1013904223)>>>0;aggregate[i]=seed/4294967296;}
    for(let y=0;y<size;y++){const fy=y/size*grid,iy=Math.floor(fy),v=fy-iy;for(let x=0;x<size;x++){
      const fx=x/size*grid,ix=Math.floor(fx),u=fx-ix,k=iy*stride+ix*3,p=(y*size+x)*4;seed=(1664525*seed+1013904223)>>>0;
      const ax=(x%4)/4,ay=(y%4)/4,au=ax*ax*(3-2*ax),av=ay*ay*(3-2*ay),ak=(y>>2)*aggregateSide+(x>>2),stone=(aggregate[ak]*(1-au)+aggregate[ak+1]*au)*(1-av)+(aggregate[ak+aggregateSide]*(1-au)+aggregate[ak+aggregateSide+1]*au)*av;
      // Correlated granules survive minification; fine noise alone averages into a flat sheen.
      const grain=(stone-.5)*75+(seed/4294967296-.5)*18,seam=(y%(size/16)<1||x%(size/4)<1)?-10:0;
      for(let ch=0;ch<3;ch++)pixels.data[p+ch]=(field[k+ch]*(1-u)+field[k+3+ch]*u)*(1-v)+(field[k+stride+ch]*(1-u)+field[k+stride+3+ch]*u)*v+grain+seam;pixels.data[p+3]=255;
    }}ctx.putImageData(pixels,0,0);return t;
  }
  function feltRelief(){
    const c=document.createElement('canvas');c.width=c.height=2048;const ctx=c.getContext('2d'),t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(!ctx.createImageData)return t;
    const side=513,grain=new Float32Array(side*side);let seed=913;for(let i=0;i<grain.length;i++){seed=(1664525*seed+1013904223)>>>0;grain[i]=seed/4294967296;}
    const pixels=ctx.createImageData(2048,2048);for(let y=0;y<2048;y++)for(let x=0;x<2048;x++){const ix=x>>2,iy=y>>2,a=(x%4)/4,b=(y%4)/4,u=a*a*(3-2*a),v=b*b*(3-2*b),k=iy*side+ix,h=(grain[k]*(1-u)+grain[k+1]*u)*(1-v)+(grain[k+side]*(1-u)+grain[k+side+1]*u)*v;seed=(1664525*seed+1013904223)>>>0;const level=70+h*115+(seed/4294967296-.5)*16,j=(y*2048+x)*4;pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=level;pixels.data[j+3]=255;}ctx.putImageData(pixels,0,0);return t;
  }
  const felt=feltTexture(),feltHeight=feltRelief();roof.color.set('#7f827e');roof.roughness=1;roof.metalness=0;roof.map=felt;roof.bumpMap=feltHeight;roof.bumpScale=.028;roof.userData.roofMembrane=true;
  const canopyMembrane=roof.clone();canopyMembrane.map=feltTexture(true);canopyMembrane.bumpScale=.003;canopyMembrane.userData.localUV=true;membraneMaterials.add(canopyMembrane);
  function texture(type){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');let seed=42;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const masonry=type.startsWith('brick'),relief=type==='brick-relief';
    x.fillStyle=relief?'#444444':masonry?'#b9cbd8':'#c4c4bd';x.fillRect(0,0,512,256);
    if(masonry)for(let row=0;row<8;row++)for(let col=-1;col<5;col++){const a=relief?185+random()*12:185+random()*20;x.fillStyle=`rgb(${a},${a},${a})`;x.fillRect(col*128+(row%2)*64+2,row*32+2,124,28);}
    for(let i=0;i<(masonry?28000:18000);i++){const a=95+random()*150;x.fillStyle=`rgba(${a},${a},${a},${masonry?.25:.32})`;x.fillRect(random()*512,random()*256,1+random()*2,1+random()*2);}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  [brick.map,brick.bumpMap]=masonryTextures();brick.bumpScale=.016;concrete.map=texture('concrete');concrete.bumpMap=concrete.map;concrete.bumpScale=.025;
  const groundConcrete=concrete.clone();groundConcrete.userData.groundSurface=true;
  function emit(geo,m,matrix){geo=geo.index?geo.toNonIndexed():geo.clone();geo.applyMatrix4(matrix);if(m===brick||m===concrete||m===groundConcrete||m===foundation||membraneMaterials.has(m)){const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,isFelt=membraneMaterials.has(m);for(let i=0;i<p.count;i++){if(m.userData.localUV)continue;const horizontal=Math.abs(n.getY(i))>.5;uv.setXY(i,(horizontal?p.getX(i):Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/(isFelt?16:m===brick?2.2:m===foundation?2:.8),(horizontal?p.getZ(i):p.getY(i))/(isFelt?16:m===brick?.996:m===foundation?2:.8));}}if(!batches.has(m))batches.set(m,[]);batches.get(m).push(geo);}
  const dummy=new THREE.Object3D();
  function box(x,y,z,w,h,d,m,angle=0){dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();emit(new THREE.BoxGeometry(w,h,d),m,dummy.matrix);}
  function edge(index){const a=g[index],b=g[(index+1)%g.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=new THREE.Vector3((b[0]-a[0])/L,0,(b[1]-a[1])/L);let n=new THREE.Vector3(-u.z,0,u.x);const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(n.x*(mid[0]-building.c[0])+n.z*(mid[1]-building.c[1])<0)n.negate();
    // Recess walls need the polygon winding, rather than the centroid heuristic.
    let area=0;for(let i=0;i<g.length;i++){const p=g[i],q=g[(i+1)%g.length];area+=p[0]*q[1]-q[0]*p[1];}n.set(u.z,0,-u.x).multiplyScalar(Math.sign(area));
    const angle=Math.atan2(-u.z,u.x),at=(x,y,d=0)=>new THREE.Vector3(a[0]-750+u.x*x+n.x*d,y,a[1]-760+u.z*x+n.z*d);
    const block=(x,y,w,h,d,m,offset=0)=>{
      // The adjacent balcony pier must finish at the recessed side-wall plane,
      // not project back to the old corner after that wall has stepped inward.
      if(design.sideWallStep&&index===(design.sideWallStep.edge+1)%g.length&&x<design.sideWallStep.depth){const end=x+w;x=design.sideWallStep.depth;w=end-x;if(w<=1e-6)return;}
      // Align end faces to adjoining facade planes. Defer their visibility
      // decision until all neighbours exist: different ground levels leave
      // parts of these caps exposed. Only overlapping portions are removed.
      const atStart=Math.abs(x)<1e-6,atEnd=Math.abs(x+w-L)<1e-6;
      if((m===brick||m===foundation||(m===dark&&index===6))&&offset<0&&Math.abs(offset+d)<1e-6&&(atStart||atEnd)){
        const geo=new THREE.BoxGeometry(w,h,d),indices=Array.from(geo.index.array);
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
        emit(geo,m,dummy.matrix);return;
      }
      const p=at(x+w/2,y+h/2,offset+d/2);box(p.x,p.y,p.z,w,h,d,m,angle);
    };return {L,at,block,angle,n};
  }
  function beam(a,b,r,m){const direction=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());dummy.updateMatrix();emit(new THREE.CylinderGeometry(r,r,direction.length(),6),m,dummy.matrix);}
  function window(p,x,y,w=1.3,h=1.45,frame=trim,curtains=false,annexHood=false,division=.5){const inset=annexHood?0:.31;
    if(!annexHood){
      // Continuous masonry reveals join the outer wall to the inset frame/backing.
      // Without this tunnel, oblique sunlight escapes between two detached planes.
      const reveal=y<1.8?foundation:brick;
      // Only the four tunnel surfaces. Box-shaped reveals added coplanar front
      // strips over the masonry and lintel, which flickered during camera motion.
      const surface=points=>{let q=points.map(([xx,yy,d])=>p.at(xx,yy,d)),centre=p.at(x+w/2,y+h/2,-.15),normal=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));if(normal.dot(centre.sub(q[0]))<0)q.reverse();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>q[i].toArray()),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(12),2));geometry.computeVertexNormals();emit(geometry,reveal,new THREE.Matrix4());};
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
    const p=step?{...face,block:(x,y,w,h,d,m,offset=0)=>{
      const split=face.L-step.width,end=x+w;
      if(x<split)face.block(x,y,Math.min(end,split)-x,h,d,m,offset);
      if(end>split)face.block(Math.max(x,split),y,end-Math.max(x,split),h,d,m,offset-step.depth);
    }}:face;

    const vent=design.vents?.find(v=>v.edge===i),cuts=[];
    // Main entrance back wall is rebuilt below with the reference door and
    // render transition. Do not leave a second facade behind those surfaces.
    if(i===6)cuts.push({x:0,y:.95,w:p.L,h:2.4});
    if(vent)for(let j=0;j<vent.count;j++)cuts.push({x:p.L*(j+1)/(vent.count+1)-.11,y:27.5,w:.22,h:.13});
    // Lintels are embedded concrete sections, not slabs attached to the facade.
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
      // Balcony crown terminates at a horizontal shelf, before the inset parapet.
      p.block(0,height-.8,p.L,roofLevel-(height-.8),.28,trim,-.14);
      p.block(0,roofLevel-.06,p.L,.10,setback+.34,concrete,-setback-.14);
    }
  }
  // One closed parapet outline, with mitred joints. Inset balcony edges meet
  // their adjacent walls at shared vertices rather than independent box ends.
  function offsetOutline(points,offsets){
    const sign=Math.sign(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0));
    const lines=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),d=Array.isArray(offsets)?offsets[i]:offsets;return {a:[a[0]+sign*dz/L*d,a[1]-sign*dx/L*d],u:[dx/L,dz/L]};});
    return lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],cross=a.u[0]*b.u[1]-a.u[1]*b.u[0],dx=b.a[0]-a.a[0],dz=b.a[1]-a.a[1],t=(dx*b.u[1]-dz*b.u[0])/cross;return [a.a[0]+a.u[0]*t,a.a[1]+a.u[1]*t];});
  }
  function ring(outer,inner,y,h,material){const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(p[0]-750,-(p[1]-760))));shape.holes.push(new THREE.Path(inner.map(p=>new THREE.Vector2(p[0]-750,-(p[1]-760))).reverse()));const geometry=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);emit(geometry,material,new THREE.Matrix4());}
  const roofFootprint=[],roofOffsets=[];
  for(let i=0;i<g.length;i++){
    const previous=(i+g.length-1)%g.length,step=design.sideWallStep;
    if(step&&i===step.edge){const p=edge(i);roofFootprint.push(g[i]);roofOffsets.push(0);for(const d of [0,-step.depth]){const v=p.at(p.L-step.width,0,d);roofFootprint.push([v.x+750,v.z+760]);roofOffsets.push(0);}}
    else if(step&&previous===step.edge){const p=edge(previous),v=p.at(p.L,0,-step.depth);roofFootprint.push([v.x+750,v.z+760]);roofOffsets.push(design.steppedFacadeEdges?.includes(i)?-design.roofShelfDepth+.14:0);}
    else{roofFootprint.push(g[i]);roofOffsets.push(design.steppedFacadeEdges?.includes(i)?-design.roofShelfDepth+.14:0);}
  }
  const outerParapet=offsetOutline(roofFootprint,roofOffsets);
  const innerParapet=offsetOutline(outerParapet,-.28),innerLining=offsetOutline(innerParapet,-.025);
  ring(outerParapet,innerParapet,roofLevel,mainParapetTop-roofLevel,brick);
  ring(innerParapet,innerLining,roofLevel,mainParapetTop-roofLevel,roof);
  ring(offsetOutline(outerParapet,.03),offsetOutline(innerParapet,-.03),mainParapetTop,.08,roof);
  root.userData.roofEnvelope={outer:outerParapet,inner:innerParapet,lining:innerLining,bottom:roofLevel,top:mainParapetTop};
  if(design.entranceReturnStep){
    const step=design.entranceReturnStep,p=edge(step.edge),width=p.L*step.widthFraction,start=(p.L-width)/2;
    // Broad central full-height masonry projection; both end portions step back.
    p.block(start,0,width,1.8,step.projection+.13,foundation,-.13);
    p.block(start,1.8,width,roofLevel-1.8,step.projection+.13,brick,-.13);
    p.block(start-.02,roofLevel,width+.04,.04,step.projection+.18,roof,-.15);
  }
  const shape=new THREE.Shape(roofFootprint.map(p=>new THREE.Vector2(p[0]-750,-(p[1]-760))));const cap=new THREE.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(0,roofLevel+.041,0);emit(cap,roof,new THREE.Matrix4());

    // Thin ground-following concrete apron; reference shows almost no raised edge.
    const apronGround=(p)=>{
      if(!terrain)return 0;
      let surface=-Infinity;const px=p.x+750,pz=p.z+760;
      for(const t of terrain.kesk1GroundTriangles??[]){const den=(t[4]-t[7])*(t[0]-t[6])+(t[6]-t[3])*(t[1]-t[7]);if(Math.abs(den)<1e-10)continue;const a=((t[4]-t[7])*(px-t[6])+(t[6]-t[3])*(pz-t[7]))/den,b=((t[7]-t[1])*(px-t[6])+(t[0]-t[6])*(pz-t[7]))/den,c=1-a-b;if(Math.min(a,b,c)>=-1e-6)surface=Math.max(surface,a*t[2]+b*t[5]+c*t[8]);}
      if(Number.isFinite(surface))return surface-12.8;
      const X=Math.max(0,Math.min(terrain.width-1.001,(p.x+750-terrain.origin[0])/terrain.step)),Z=Math.max(0,Math.min(terrain.height-1.001,(p.z+760-terrain.origin[1])/terrain.step)),i=Math.floor(X),j=Math.floor(Z),u=X-i,v=Z-j,k=j*terrain.width+i,t=terrain.values;
      return (t[k]*(1-u)*(1-v)+t[k+1]*u*(1-v)+t[k+terrain.width]*(1-u)*v+t[k+terrain.width+1]*u*v)/10-12.8;
    };
    function apron(p,x,width,depth,offset,material=concrete,lift=.003){
      if(material===concrete)material=groundConcrete;
      const earlier=[...(root.userData.groundPatches??[])];
      (root.userData.groundPatches??=[]).push([[x,offset],[x+width,offset],[x+width,offset+depth],[x,offset+depth]].map(([u,d])=>{const q=p.at(u,0,d);return [q.x+750,q.z+760];}));
      // Clip each actual ground triangle to the apron rectangle. This preserves
      // every terrain break inside the strip, instead of interpolating its corners.
      const origin=p.at(0,0,0),u=p.at(1,0,0).sub(origin),n=p.at(0,0,1).sub(origin);
      const triangles=terrain?.kesk1GroundTriangles;
      if(triangles?.length){
        for(const t of triangles){
          let poly=[0,3,6].map(i=>{const dx=t[i]-750-origin.x,dz=t[i+1]-760-origin.z;return [dx*u.x+dz*u.z,dx*n.x+dz*n.z,t[i+2]-12.8+lift];});
          for(const plane of [q=>q[0]-x,q=>x+width-q[0],q=>q[1]-offset,q=>offset+depth-q[1]]){
            const clipped=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b);if(da>=0)clipped.push(a);if((da>=0)!==(db>=0)){const f=da/(da-db);clipped.push(a.map((v,k)=>v+(b[k]-v)*f));}}poly=clipped;
          }
          if(poly.length<3)continue;
          let pieces=[poly];
          for(const old of earlier){
            const clip=old.map(q=>{const dx=q[0]-750-origin.x,dz=q[1]-760-origin.z;return [dx*u.x+dz*u.z,dx*n.x+dz*n.z];});
            const area=clip.reduce((s,a,i)=>{const b=clip[(i+1)%clip.length];return s+a[0]*b[1]-a[1]*b[0];},0),sign=Math.sign(area),outside=[];
            for(const piece of pieces){let inside=piece;
              for(let e=0;e<clip.length&&inside.length;e++){const a=clip[e],b=clip[(e+1)%clip.length],plane=q=>sign*((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0])),yes=[],no=[];
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
  // Simple square lift overrun centred on the roof, as requested.
  const shaftAngle=Math.atan2(g[2][1]-g[1][1],g[2][0]-g[1][0]);
  const shaft=[[-2.7,-2.7],[2.7,-2.7],[2.7,2.7],[-2.7,2.7]].map(([x,z])=>[building.c[0]+x*Math.cos(shaftAngle)-z*Math.sin(shaftAngle),building.c[1]+x*Math.sin(shaftAngle)+z*Math.cos(shaftAngle)]);
  for(let i=0;i<shaft.length;i++){const a=shaft[i],b=shaft[(i+1)%shaft.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(-dz,dx);
    const rearDoor=design.liftRoofDetails&&i===3,doorX=3.05,doorW=.90,doorY=roofLevel+.041,doorH=2;
    const panel=(x,y,w,h,d,m,offset=0)=>box(a[0]+dx*(x+w/2)/length+dz/length*offset-750,y+h/2,a[1]+dz*(x+w/2)/length-dx/length*offset-760,w,h,d,m,angle);
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
    box((a[0]+b[0])/2-750,31.23,(a[1]+b[1])/2-760,length,.1,.18,roof,angle);
  }
  const shaftCap=new THREE.ShapeGeometry(new THREE.Shape(shaft.map(p=>new THREE.Vector2(p[0]-750,-(p[1]-760)))));shaftCap.rotateX(-Math.PI/2);shaftCap.translate(0,31.2,0);emit(shaftCap,roof,new THREE.Matrix4());
  if(design.liftRoofDetails){
    const x=building.c[0]-.8*Math.cos(shaftAngle)+.2*Math.sin(shaftAngle)-750,z=building.c[1]-.8*Math.sin(shaftAngle)-.2*Math.cos(shaftAngle)-760;
    for(const [y,top,bottom,h,m] of [[31.23,.26,.30,.06,metal],[31.44,.13,.13,.38,dark],[31.66,.07,.27,.12,metal]]){
      dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();emit(new THREE.CylinderGeometry(top,bottom,h,12),m,dummy.matrix);
    }
    root.userData.liftCowl={x,y:31.72,z};
  }

  const balconyEdges=design.balconyEdges;
  for(let i=0;i<g.length;i++){const original=edge(i),L=original.L;
    const shoulder=design.steppedFacadeEdges?.includes(i)?design.balconyShoulder:0,scale=(L-2*shoulder)/L;
    // Front panels finish inside continuous brick cheeks. Keep the recessed
    // rear wall/doors fixed and shorten slabs, rather than burying those doors.
    const occupied= y=>balconyEdges.includes(i)&&y>=1.9;
    const p={...original,block:(x,y,w,h,d,m,offset=0)=>{
      if(occupied(y)){if(offset>=0)offset-=.30;else if(offset+d>-.05)d=-.05-offset;original.block(shoulder+x*scale,y,w*scale,h,d,m,offset);}
      else original.block(x,y,w,h,d,m,offset);
    },at:(x,y,d=0)=>original.at(occupied(y)?shoulder+x*scale:x,y,occupied(y)&&d>=0?d-.36:d)};
    if(shoulder)for(const x of [0,L-shoulder])original.block(x,1.8,shoulder,height-.8-1.8,1.05,brick,-1.05);
    if(balconyEdges.includes(i)){
      if(i===18)for(let x=.08;x<L-.05;x+=.09)p.block(x,height-.8,.025,.74,.035,concrete,.16);
      // Shaded open base, with the first enclosed balcony raised above it.
      if(i===18){const x=(L-1.25)/2-.08,w=1.41;p.block(.12,0,L-.24,.27,.04,foundation,-.98);p.block(.12,1.23,L-.24,.57,.04,foundation,-.98);p.block(.12,.27,x-.12,.96,.04,foundation,-.98);p.block(x+w,.27,L-.12-x-w,.96,.04,foundation,-.98);}else{
      p.block(.12,0,L-.24,1.8,.04,[2,9,11,13,18].includes(i)?foundation:dark,[2,9,11,13,18].includes(i)?-.98:.015);
      }
      for(const x of [0,L-shoulder])p.block(x,0,shoulder,1.8,1.13,foundation,-1.13);
      for(let r=0;r<design.floors;r++){const y=1.9+r*design.floorPitch,brown=(i===2&&r===1)||(i===11&&r===1),timber=i===9&&r===0,frame=brown||timber?wood:trim;
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
          for(let j=0;j<panes;j++){p.block(.15+j*w,y+1.22,w-.04,1.4,.04,glass,.12);if(r===0||brown)for(let k=0;k<3;k++)p.block(.18+j*w+k*w/4,y+1.23,.035,1.43,.014,timber?wood:r===0?trim:green,.17);p.block(.12+j*w,y+1.2,.055,1.48,.1,balconyFrame,.19);}
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
      if(i===14)window(p,L*.76,y,1.3,1.45,trim,false,false,r===0?.3:.5);
      if(i===16&&r>0)window(p,(L-1.65)/2,y,1.65);
      if(i===19)window(p,L*.83,y);
      if(i===4)window(p,L*.32,y,L*.37,1.45,r===2?wood:trim,r===2);
      if(i===6&&r>0)window(p,(L-2.2)/2,y-.15,2.2,1.45);
      if(i===8)window(p,L*.1,y); // Single column: the two spurious lower windows are removed.
    }
    if([4,8,14,19].includes(i))window(p,i===8?L*.1:i===4?L*.32:i===14?L*.76:L*.65,.35,1.2,.8);
    // Transform the complete aperture, including its plane-built reveals.
    if(i===18)window({...p,at:(x,y,d=0)=>p.at(x,y,d-.94),block:(x,y,w,h,d,m,offset=0)=>p.block(x,y,w,h,d,m,offset-.94)},(L-1.25)/2,.35,1.25,.8);
  }
  // Main entrance: separate left basement bay and right main-door stair.
  // September 2023 reference: the entrance fills the bay between both walls.
  // The old 7% margins left grass exposed beside the stair and a short canopy.
  const entryFace=edge(6),entry={...entryFace,at:(x,y,d)=>entryFace.at(entryFace.L-x,y,d),block:(x,y,w,h,d,m,offset=0)=>entryFace.block(entryFace.L-x-w,y,w,h,d,m,offset)},ew=entry.L,ex=0;
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
    // Embed the back edge in the wall, keeping the outer canopy edge fixed.
    entry.block(0,3.35,entry.L,.18,1.46,concrete,-.04);entry.block(0,3.53,entry.L,.16,1.46,canopyMembrane,-.04);
  // Extend entrance solids down into the sampled apron. The old fixed
  // +.02/.05 bottoms left daylight below the landing and stair side faces.
  const entrySolid=(x,y,w,h,d,m,offset)=>{
    const bottom=Math.min(y,...[x,x+w].flatMap(xx=>[offset,offset+d].map(dd=>apronGround(entry.at(xx,0,dd))-.03)));
    entry.block(x,bottom,w,y+h-bottom,d,m,offset);
  };
  // Left bay has a solid landing edge, not a second flight of stairs.
    entrySolid(-.03,.05,stairX+.03,.9,2.76,concrete,-.04);
  entry.block(ex+.08,.95,ew*.30,2.20,.075,dark,.13);
  entry.block(stairX-.13,.95,.26,2.4,1.05,brick,.02);
    entrySolid(stairX,.05,stairW,.9,1.16,concrete,-.04);
  for(let j=0;j<5;j++)entrySolid(stairX,.02,stairW,.9-j*.18,.32,concrete,1.12+j*.32);
  for(const x of [ex+ew-.06]){for(const [d,y] of [[1.1,.95],[2.6,.08]])beam(entry.at(x,y,d),entry.at(x,y+.95,d),.025,metal);beam(entry.at(x,1.9,1.1),entry.at(x,1.03,2.6),.025,metal);}
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
  const annexEndX=annex.L*.83,canopyEnd=annex.L,annexStart=design.annexStart??.05;
  root.userData.annexBounds={start:annexStart,end:annexEndX,canopyEnd,depth:annexDepth};
  if(annexStart>.05)apron(annex,-.03,annexStart+.06,.4,-.05);
  // User's outlined 2024 photograph resolves the apparent tall block:
  // the black roof sits behind a solid parapet about one metre higher.
  const annexMembrane=roof,annexRoofY=2.01,parapetTop=annexRoofY+.045+design.annexParapetHeight,parapetThickness=.18;
  membraneMaterials.add(annexMembrane);annexMembrane.map=felt;annexMembrane.bumpMap=feltHeight;annexMembrane.bumpScale=.028;annexMembrane.roughness=1;
  annex.block(annexStart,-1.14,annexEndX-annexStart,annexRoofY+1.14,annexDepth,concrete,.02);
  // Keep the membrane inside the concrete shell: its side face must not
  // intersect the exterior parapet and create a flickering horizontal stripe.
  annex.block(annexStart+parapetThickness,annexRoofY,annexEndX-annexStart-parapetThickness,.045,annexDepth-parapetThickness,annexMembrane,.02);
  // Outer side and far-end return; the entrance end stays open to the canopy.
  annex.block(annexStart,annexRoofY,annexEndX-annexStart,parapetTop-annexRoofY,parapetThickness,concrete,annexDepth-parapetThickness+.02);
  annex.block(annexStart,annexRoofY,parapetThickness,parapetTop-annexRoofY,annexDepth,concrete,.02);
  annex.block(annexStart-.02,parapetTop,annexEndX-annexStart+.04,.07,parapetThickness+.06,roof,annexDepth-parapetThickness-.01);
  annex.block(annexStart-.03,parapetTop,parapetThickness+.06,.07,annexDepth+.06,roof,-.01);
  // Dark waterproof lining turns up the inside of the parapet and wall.
  annex.block(annexStart+.18,annexRoofY,annexEndX-annexStart-.18,parapetTop-annexRoofY,.025,annexMembrane,annexDepth-parapetThickness-.005);
  annex.block(annexStart+.18,annexRoofY,.025,parapetTop-annexRoofY,annexDepth-parapetThickness-.02,annexMembrane,.02);
  annex.block(annexStart+.18,annexRoofY,canopyEnd-annexStart-.18,.22,.025,annexMembrane,.02);
  // June 2012 view exposes the end window, dark grille and broad projecting hood.
  const annexEnd={block:(x,y,w,h,d,m,offset=0)=>{const p=annex.at(annexEndX+offset+d/2,y+h/2,x+w/2);box(p.x,p.y,p.z,w,h,d,m,annex.angle+Math.PI/2);}};
  const aw=1.65,ax=pathOffset+.18;
  window(annexEnd,ax,.35,aw,1.15,wood,false,true);
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
      beam(annex.at(xx,.14,d+.56),annex.at(xx,.14,d+.69),.105,tire);
      beam(annex.at(xx,.9,d+.7),annex.at(xx,1.05,d+.7),.024,metal);
    }
    beam(annex.at(x+.06,1.05,d+.7),annex.at(x+.56,1.05,d+.7),.024,metal);
  }
  // Rear entrance between the balcony and the solid western wing.
  const rear=edge(16),rx=.12,rw=rear.L-.24;
  rear.block(rx,.85,rw,2.5,.06,dark,.02);rear.block(rx+.16,.9,rw-.32,2.3,.07,wood,.1);
  rear.block(rx-.1,3.4,rw+.2,.17,1.05,concrete,.02);
  rear.block(rx-.1,3.57,rw+.2,.025,1.05,roof,.02);
  if(!design.rearAccessDraft){
  rear.block(rx,0,rw,.85,.85,concrete,.02);
  for(let j=0;j<5;j++)rear.block(rx,0,rw,.85-j*.17,.3,concrete,.87+j*.3);
  for(const x of [rx+.04,rx+rw-.04]){beam(rear.at(x,.85,.85),rear.at(x,1.75,.85),.022,redWood);beam(rear.at(x,.05,2.3),rear.at(x,.95,2.3),.022,redWood);beam(rear.at(x,1.75,.85),rear.at(x,.95,2.3),.022,redWood);}
  }
  // June 2023 rear reference: fan grille inside the masonry reveal,
  // complete perimeter and curved cross-brace, in front of the inset frame.
  const grille=edge(14),gx=grille.L*.76,gd=-.045,gx0=gx+.04,gx1=gx+1.26,gy0=2.84,gy1=4.21;
  for(let j=0;j<=12;j++){const a=j*Math.PI/24,dx=Math.cos(a),dy=Math.sin(a),length=Math.min((gx1-gx0)/Math.max(dx,.0001),(gy1-gy0)/Math.max(dy,.0001));beam(grille.at(gx0,gy0,gd),grille.at(gx0+dx*length,gy0+dy*length,gd),.012,trim);}
  for(const x of [gx0,gx1])beam(grille.at(x,gy0,gd),grille.at(x,gy1,gd),.018,trim);
  for(const y of [gy0,gy1])beam(grille.at(gx0,y,gd),grille.at(gx1,y,gd),.018,trim);
  for(let j=0;j<24;j++){const a=j*Math.PI/48,b=(j+1)*Math.PI/48;beam(grille.at(gx0+.98*Math.cos(a),gy0+.98*Math.sin(a),gd),grille.at(gx0+.98*Math.cos(b),gy0+.98*Math.sin(b),gd),.012,trim);}
  const signWall=edge(1);
  function plaque(text,x,y,w,h){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f3f2e8';ctx.fillRect(0,0,512,256);ctx.fillStyle='#263130';ctx.font=`bold ${text===design.number?200:105}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,133);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=mat('#ffffff');m.map=t;const right=new THREE.Vector3(signWall.n.z,0,-signWall.n.x),matrix=new THREE.Matrix4().makeBasis(right,new THREE.Vector3(0,1,0),signWall.n);matrix.setPosition(signWall.at(x,y,.16));emit(new THREE.PlaneGeometry(w,h),m,matrix);}
  plaque(design.number,signWall.L-.7,4,.42,.4);plaque(design.street,signWall.L-.7,3.62,.85,.25);
  // Flower box on the second-floor window and a wall-mounted satellite dish.
  const fp=edge(8),fx=fp.L*.1;fp.block(fx,5.65,1.3,.22,.3,wood,-.12);
  // September 2023 photo shows an empty short flagpole socket, not a flying flag.
  // Position and length are approximate, referenced to the lowest balcony frame.
  const flagX=fp.L-.85;fp.block(flagX,3.6,.09,.32,.035,metal,0);
  beam(fp.at(flagX+.045,3.65,.025),fp.at(flagX+.045,3.92,.23),.024,metal);
  for(let j=0;j<12;j++){const p=fp.at(fx+.08+j*.1,5.95+.08*Math.sin(j),.09);dummy.position.copy(p);dummy.rotation.set(0,0,0);dummy.updateMatrix();emit(new THREE.IcosahedronGeometry(.095,0),j%3?flower:green,dummy.matrix);}
  const bp=edge(2),dish=bp.at(bp.L-.25,8.6,.65);beam(bp.at(bp.L-.25,8.3,.12),dish,.035,metal);dummy.position.copy(dish);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),bp.n.clone().add(new THREE.Vector3(0,.25,0)).normalize());dummy.scale.set(1,1,.22);dummy.updateMatrix();emit(new THREE.SphereGeometry(.42,16,10),trim,dummy.matrix);dummy.scale.set(1,1,1);
  function bench(p,x,d){for(let j=0;j<5;j++)p.block(x,.45,2,.05,.075,redWood,d+j*.09);for(let j=0;j<6;j++)p.block(x,.57+j*.1,2,.07,.065,redWood,d);for(const xx of [x+.25,x+1.75]){beam(p.at(xx,.05,d+.16),p.at(xx,.48,d+.16),.045,metal);beam(p.at(xx,.43,d+.03),p.at(xx,1.13,d+.03),.035,metal);}}
  bench(edge(8),edge(8).L*.63,4.35);
  const grassBench=edge(8),bx=-10.5;grassBench.block(bx,.47,2,.08,.4,wood,4.35);grassBench.block(bx,.85,2,.28,.07,redWood,4.35);for(const x of [bx+.25,bx+1.75])grassBench.block(x,0,.12,1.12,.17,concrete,4.45);
  // Local parking/access widening. Reference shows parking plus a driving aisle,
  // then a return to the mapped 5 m living street towards Kesk 5.
  if(terrain){
    const asphalt=mat('#83877e');asphalt.userData.groundSurface=true;
    const ground=(x,z)=>{const xx=Math.max(0,Math.min(terrain.width-1.001,(x-terrain.origin[0])/terrain.step)),zz=Math.max(0,Math.min(terrain.height-1.001,(z-terrain.origin[1])/terrain.step)),i=Math.floor(xx),j=Math.floor(zz),u=xx-i,v=zz-j,k=j*terrain.width+i,d=terrain.values;return (d[k]*(1-u)*(1-v)+d[k+1]*u*(1-v)+d[k+terrain.width]*(1-u)*v+d[k+terrain.width+1]*u*v)/10-12.8+.12;};
    function quad(points,m){const geo=new THREE.BufferGeometry(),ids=[0,1,2,0,2,3];geo.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>[points[i][0]-750,ground(...points[i]),points[i][1]-760]),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(ids.flatMap(i=>[points[i][0],points[i][1]]),2));geo.computeVertexNormals();emit(geo,m,new THREE.Matrix4());}
    const road=[[232.3,555.5,5],[228.8,564.4,8.4],[218,591.9,8.4],[221.8,601.3,5]];
    for(let i=0;i<road.length-1;i++){const a=road[i],b=road[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len,steps=Math.ceil(len);
      const point=(t,side)=>[a[0]+(b[0]-a[0])*t+nx*(a[2]+(b[2]-a[2])*t)*side/2,a[1]+(b[1]-a[1])*t+nz*(a[2]+(b[2]-a[2])*t)*side/2];
      for(let j=0;j<steps;j++)quad([point(j/steps,-1),point((j+1)/steps,-1),point((j+1)/steps,1),point(j/steps,1)],asphalt);
    }
    const approach=edge(6),width=approach.L,left=0;
    const roadPoint=(x,d)=>{const p=approach.at(x,0,d);return [p.x+750,p.z+760];};
    // Lay continuous concrete into the stair footprint first. Later driveway
    // polygons are clipped against it, rather than stealing a strip at the join.
    // Retain the established concrete apron footprint as stairs widen over it.
    const apronInset=approach.L*.07;
    apron(approach,-.45,apronInset+.50,3.3,-.20);
    apron(approach,approach.L-apronInset-.05,apronInset+.50,3.3,-.20);
    apron(approach,left-.03,width+.06,12.3,-.10,asphalt,.003);
    const walk=edge(8);for(let x=-8;x<walk.L+2;x+=1){const pts=[[x,4.85],[x+1,4.85],[x+1,6.05],[x,6.05]].map(([u,d])=>{const p=walk.at(u,0,d);return[p.x+750,p.z+760];});quad(pts,groundConcrete);}
  }
  // Keep exposed portions of structural end faces. Neighbours only hide the
  // intersection, not the whole cap (their terrain-dependent bottoms differ).
  // Subtract coplanar triangles before batching to avoid duplicate skins.
  const capOccluders=new Map();
  for(const material of [brick,foundation,dark]){
    const triangles=[];
    for(const part of batches.get(material)||[]){const p=part.attributes.position;for(let i=0;i<p.count;i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      triangles.push({points,normal});
    }}capOccluders.set(material,triangles);
  }
  for(const cap of pendingCaps){
    const normal=cap.points[1].clone().sub(cap.points[0]).cross(cap.points[2].clone().sub(cap.points[0])).normalize();let fragments=[cap.points];
    for(const other of capOccluders.get(cap.material)){
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
  for(const [material,parts] of batches){const merged=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const size=parts[0].attributes[name].itemSize,total=parts.reduce((n,p)=>n+p.attributes[name].array.length,0),array=new Float32Array(total);let offset=0;for(const p of parts){array.set(p.attributes[name].array,offset);offset+=p.attributes[name].array.length;}merged.setAttribute(name,new THREE.BufferAttribute(array,size));}merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=!material.userData.groundSurface;mesh.receiveShadow=true;root.add(mesh);parts.forEach(p=>p.dispose());}
  root.userData.setTextures=enabled=>{for(const m of [brick,concrete,groundConcrete,foundation,...membraneMaterials]){m.userData.texture??=m.map;m.userData.bumpTexture??=m.bumpMap;m.map=enabled?m.userData.texture:null;m.bumpMap=enabled?m.userData.bumpTexture:null;m.needsUpdate=true;}};
  return root;
}



