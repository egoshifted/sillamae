import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {consolidatedFacades} from './facades.ts';
import {createBuilding} from './model.ts';
import {openings,openingFrame,openingLoop} from './openings.ts';
import {footprint,roofPolygons} from './symmetric-shell.ts';

export function createDetail(context:OverrideContext):StudyModel {
  const shell=createBuilding(context),root=shell.root,datum=root.userData.audit.datum;
  root.name='kesk10-refinement';
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.MeshStandardMaterial[]=[],textures:THREE.Texture[]=[];
  geometries.push(...consolidatedFacades(root,context));
  const detail={value:1},L=Math.hypot(30.72,15.01),dx=30.72/L,dz=15.01/L;
  const surface=(name:string,color:number,roughness=1,metalness=0)=>{const m=new THREE.MeshStandardMaterial({name:'Kesk 10 '+name,color,roughness,metalness});materials.push(m);return m;};
  const plaster=surface('ochre render',0xd8bd82),trim=surface('cream painted mouldings',0xe5dfc9),roof=surface('grey sheet metal',0x8c999e,.82,.15),glass=surface('recessed glazing',0x344347,.28,.15),wood=surface('dark entrance timber',0x38332c,.85),frame=surface('pale window frames',0xdfded2,.85),iron=surface('painted grille',0x373a33,.85,.12),stone=surface('weathered steps',0x8e897b),fanlight=surface('pale fanlight backing',0xc9ccc3,.9),fold=surface('folded weatherproofing',0x8c999e,.85,.15),brown=surface('aged brown frames',0x655044,.95),rail=surface('oxidised brown handrail',0x594039,.92,.1),towerRoof=surface('radial sheet metal',0x8c999e,.82,.15),rearTrim=surface('weathered rear render mouldings',0xe5dfc9,.98),hardware=surface('worn silver door pulls',0x9e9e93,.48,.55);
  function weather(m:THREE.MeshStandardMaterial,kind:number){
    m.onBeforeCompile=s=>{
      s.uniforms.k10Detail=detail;
      s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 k10P;').replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 k10World=(modelMatrix*vec4(position,1.)).xyz;
      vec2 k10Plan=k10World.xz+vec2(${context.frame.origin[0]-302.4},${context.frame.origin[1]-555.92});
      k10P=vec3(dot(k10Plan,vec2(${dx},${dz})),k10World.y+${context.frame.base-datum},dot(k10Plan,vec2(${dz},${-dx})));`);
      s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 k10P;uniform float k10Detail;float k10Relief=0.;
      float k10Hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float k10Noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(k10Hash(i),k10Hash(i+vec2(1.,0.)),f.x),mix(k10Hash(i+vec2(0.,1.)),k10Hash(i+1.),f.x),f.y);}
      `).replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=k10P;float n=k10Noise(vec2(p.x+p.z,p.y)*2.);
      ${kind===1?`float low=1.-smoothstep(.10,.65,p.y);float dirt=exp(-max(p.y,0.)*1.7)*(.13+.13*n);
      float rear=smoothstep(17.3,17.85,p.z),broad=k10Noise(vec2(p.x+p.z,p.y)*.65);
      diffuseColor.rgb*=1.-k10Detail*(dirt+.13*(n-.5)+.10*(broad-.5));
      float front=1.-smoothstep(1.35,1.9,p.z);
      float wornArea=(exp(-pow((p.x-1.2)/1.5,2.))+exp(-pow((p.x-10.7)/.9,2.))+exp(-pow((p.x-32.8)/1.1,2.)))*exp(-max(p.y,0.)*2.7)*front;
      float side=exp(-pow(p.x/.3,2.))*exp(-pow((p.z-10.4)/.65,2.))*exp(-pow((p.y-4.7)/1.3,2.));
      float grain=k10Noise(vec2(p.x+p.z,p.y)*28.);
      float broken=k10Noise(vec2(p.x+p.z,p.y)*7.);
      float lost=smoothstep(.26,.36,clamp(wornArea+side,0.,1.)-(.20+.30*broken+.12*grain));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.25,.24,.20),lost*.72*k10Detail);
      float frontLoss=front*(1.-smoothstep(.12,.34,p.y+.10*broken))*exp(-pow((p.x-2.)/1.3,2.));
      float northwestLoss=(1.-smoothstep(.015,.06,abs(p.x)))*(1.-smoothstep(1.1,1.5,abs(p.z-16.1+.18*(broken-.5))))*(1.-smoothstep(.12,.38,p.y+.14*broken));
      float exposure=clamp(max(frontLoss,northwestLoss),0.,1.);
      float edgeNoise=.10*broken+.05*grain;
      float exposed=smoothstep(.20,.25,exposure-edgeNoise),rim=smoothstep(.11,.16,exposure-edgeNoise)-exposed;
      vec3 wallNormal=normalize(cross(dFdx(p),dFdy(p)));float along=abs(wallNormal.x)>abs(wallNormal.z)?p.z:p.x;
      vec2 brick=vec2(along/.25,p.y/.082)+vec2(.020,.025)*(vec2(k10Noise(vec2(along,p.y)*45.),k10Noise(vec2(along+4.,p.y)*34.))-.5);brick.x+=mod(floor(brick.y),2.)*.5;
      vec2 bf=fract(brick),dist=min(bf,1.-bf),aa=max(fwidth(brick),vec2(.005));
      float bed=1.-smoothstep(.035-aa.y,.035+aa.y,dist.y),perp=1.-smoothstep(.018-aa.x,.018+aa.x,dist.x);
      float joint=max(bed,perp),unit=k10Hash(floor(brick));
      vec3 clay=vec3(.28,.12,.075)*(.70+.50*unit+.20*(grain-.5));
      float chipped=smoothstep(.68,.82,grain)* (1.-smoothstep(.02,.10,min(dist.x,dist.y)));
      vec3 masonry=mix(clay,vec3(.25,.235,.20),max(joint,chipped*.8));
      masonry=mix(masonry,vec3(.26,.185,.13),smoothstep(.3,.9,max(aa.x,aa.y)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.32,.26),rim*.75*k10Detail);
      float remnants=smoothstep(.62,.76,broken*.55+grain*.45);
      exposed*=1.-remnants*.75;
      diffuseColor.rgb=mix(diffuseColor.rgb,masonry,exposed*k10Detail);
      k10Relief=exposed*k10Detail*(.003*(1.-joint)-.002*chipped+.001*(grain-.5));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.21,.17),low*.42*k10Detail);
      float wear=exp(-pow((p.x-9.24)/.55,2.))*exp(-pow((p.y-3.9)/2.1,2.))*exp(-pow((p.z-1.3)/.4,2.));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.37,.35,.29),wear*smoothstep(.40,.65,n)*.5*k10Detail);
      float repairX=p.x+.32*(broken-.5)+.12*(grain-.5);float repairArea=((1.-smoothstep(1.0,1.18,abs(repairX-4.0)))*(1.-smoothstep(.6,.9,p.y+.45*broken))+(1.-smoothstep(.65,.85,abs(repairX-11.5)))*(1.-smoothstep(1.35,1.6,p.y+.5*broken))+(1.-smoothstep(1.3,1.5,abs(repairX-24.0)))*(1.-smoothstep(1.7,2.0,p.y+.6*broken))+(1.-smoothstep(.7,.9,abs(repairX-30.0)))*(1.-smoothstep(.7,1.0,p.y+.4*broken)));
      float rearPaint=rear*smoothstep(.36,.44,repairArea-.16*broken-.08*grain);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.39,.37,.30),rearPaint*.50*k10Detail);
      float streaks=rear*(.012+.018*broken)*(1.-smoothstep(6.9,7.5,p.y))*smoothstep(.55,.8,k10Noise(vec2(p.x*8.,p.y*.35)));
      diffuseColor.rgb*=1.-k10Detail*(streaks+.035*(grain-.5));`:
      kind===4?`float grain=k10Noise(vec2(p.x+p.z,p.y)*36.);
      float pores=k10Noise(vec2(p.x+p.z,p.y)*12.);
      float chips=smoothstep(.71,.79,pores*.7+grain*.3);
      diffuseColor.rgb*=1.-k10Detail*(.035*(grain-.5)+.17*chips);
      float dirty=(1.-smoothstep(.15,.8,p.y))*.18;
      diffuseColor.rgb*=1.-dirty*k10Detail;`:
      `vec3 norm=normalize(cross(dFdx(p),dFdy(p)));float u=abs(norm.x)>abs(norm.z)?p.z:p.x;
      if(${kind}==3){u=atan(p.x-17.25,p.z-17.65)*3.5;}
      float f=abs(fract(u/.55+.5)-.5);float seam=1.-smoothstep(.006,.006+max(fwidth(u/.55),.008),f);
      diffuseColor.rgb*=1.-k10Detail*(.09*seam+.035*n);`}
      `);
      if(kind===1)s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
      vec3 k10SX=dFdx(-vViewPosition),k10SY=dFdy(-vViewPosition);
      vec3 k10RX=cross(k10SY,normal),k10RY=cross(normal,k10SX);float k10Det=dot(k10SX,k10RX);
      normal=normalize(abs(k10Det)*normal-sign(k10Det)*(dFdx(k10Relief)*k10RX+dFdy(k10Relief)*k10RY));`);
    };m.customProgramCacheKey=()=>`kesk10-surfaces-2-${kind}`;
  }
  weather(plaster,1);weather(roof,2);weather(towerRoof,3);weather(trim,4);weather(rearTrim,4);weather(stone,4);weather(rail,4);
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const n=o.name;
    o.material=n==='rear-stairwell-roof'?towerRoof:n.includes('roof')||n.startsWith('ridge-stack')||n.startsWith('rear-dormer-')&&!n.includes('vent')?roof:n.includes('landing')||n.includes('-step-')||n.startsWith('foundation')?stone:n.includes('surround')?trim:n.endsWith('infill')?n.includes('door')||n.includes('vent')?wood:glass:n==='rear-stairwell-door'?wood:n.endsWith('-vent')?wood:plaster;
  });
  for(const mesh of root.children){
    if(!(mesh instanceof THREE.Mesh)||!mesh.name.includes('-landing')&&!mesh.name.includes('-step-'))continue;
    const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=g.getAttribute('position');g.computeBoundingBox();
    const centre=g.boundingBox!.getCenter(new THREE.Vector3()),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3){
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
      const normal=b.clone().sub(a).cross(c.clone().sub(a)),mid=a.clone().add(b).add(c).multiplyScalar(1/3);
      if(normal.dot(mid.sub(centre))<0){p.setXYZ(i+1,c.x,c.y,c.z);p.setXYZ(i+2,b.x,b.y,b.z);}
    }
    g.computeVertexNormals();geometries.push(g);mesh.geometry=g;
  }
  function add(name:string,g:THREE.BufferGeometry,m:THREE.MeshStandardMaterial){geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.userData.id='kesk10/detail/'+name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
  function tube(name:string,pts:THREE.Vector3[],r:number,m:THREE.MeshStandardMaterial){return add(name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.max(12,pts.length*3),r,6,false),m);}
  function pipe(name:string,pts:THREE.Vector3[],r:number,m:THREE.MeshStandardMaterial){
    const path=new THREE.CurvePath<THREE.Vector3>();for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(pts[i-1],pts[i]));
    return add(name,new THREE.TubeGeometry(path,Math.ceil(path.getLength()*20),r,8,false),m);
  }
  let outward=new THREE.Vector3(0,0,1);
  function beam(name:string,a:THREE.Vector3,b:THREE.Vector3,w:number,d:number,m:THREE.MeshStandardMaterial){const v=b.clone().sub(a);if(v.length()<1e-5)return;const mesh=add(name,new THREE.BoxGeometry(w,v.length(),d),m);mesh.position.copy(a).add(b).multiplyScalar(.5);const y=v.normalize(),x=y.clone().cross(Math.abs(y.dot(outward))>.99?new THREE.Vector3(0,1,0):outward).normalize(),z=x.clone().cross(y);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));return mesh;}
  const world=(x:number,z:number,h:number)=>new THREE.Vector3(x-context.frame.origin[0],datum+h-context.frame.base,z-context.frame.origin[1]);
  for(const o of openings){
    const front=o.id.startsWith('street-'),side=o.id.startsWith('northwest-')||o.id.startsWith('southeast-'),vent=o.id.includes('vent');
    const ornament=front||side&&(!!o.arch||vent);
    const crest=o.id.includes('street-centre-L1')||o.id==='northwest-pair-L1'||o.id==='southeast-L1';
    const f=openingFrame(o),x=o.centre*f.length,point=(u:number,h:number,d:number)=>world(o.a[0]+f.dx*u+f.nx*d,o.a[1]+f.dz*u+f.nz*d,h);
    outward.set(f.nx,0,f.nz);
    const cy=(o.bottom+o.top)/2,loop=openingLoop(o).map(([u,h])=>[x+(u-x)*(1-.075/o.width),cy+(h-cy)*(1-.075/(o.top-o.bottom))]),door=o.kind==='door',m=door||vent?wood:o.id.startsWith('northwest-L')?brown:frame;
    for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];beam(o.id+'-frame-'+i,point(a[0],a[1],-.25),point(b[0],b[1],-.25),.065,.075,m);}
    const ring=(name:string,u:number,h:number,r:number,d:number,segments=24)=>tube(name,Array.from({length:segments+1},(_,i)=>point(u+Math.cos(i*Math.PI*2/segments)*r,h+Math.sin(i*Math.PI*2/segments)*r,d)),.022,trim);
    const relief=(name:string,u:number,h:number,r:number,d:number)=>{const mesh=add(name,new THREE.CylinderGeometry(r,r,.045,8),trim);mesh.position.copy(point(u,h,d));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),outward);ring(name+'-rim',u,h,r*.88,d+.03,8);ring(name+'-centre',u,h,r*.24,d+.035);for(let i=0;i<8;i++){const a=i*Math.PI/4;const points=Array.from({length:9},(_,j)=>{const t=j*Math.PI*2/8,rr=r*(.43+.18*Math.cos(t));return point(u+Math.cos(a)*rr-Math.sin(a)*r*.11*Math.sin(t),h+Math.sin(a)*rr+Math.cos(a)*r*.11*Math.sin(t),d+.04);});tube(name+'-petal-'+i,points,.015,trim);}};
    const curl=(name:string,pts:number[][])=>tube(name,pts.map(([u,h])=>point(u,h,.105)),.035,trim);
    if(!door&&ornament&&(o.arch||vent)){
      const y=o.bottom-.11;
      for(const sign of [-1,1])curl(o.id+'-sill-scroll-'+sign,[[x+sign*o.width*.46,y],[x+sign*o.width*.38,y-.20],[x+sign*o.width*.23,y-.35],[x+sign*o.width*.10,y-.27],[x+sign*o.width*.17,y-.18],[x+sign*o.width*.24,y-.23]]);
      beam(o.id+'-pendant',point(x,y,.10),point(x,y-.33,.10),.075,.11,trim);
      if(o.id.endsWith('-high'))relief(o.id+'-medallion',x,7.88,.37,.045);
    }
    if(crest){
      for(const sign of [-1,1]){
        curl(o.id+'-pediment-scroll-'+sign,[[x+sign*.66,o.top+.09],[x+sign*.64,o.top+.31],[x+sign*.49,o.top+.30],[x+sign*.43,o.top+.17],[x+sign*.31,o.top+.27],[x+sign*.28,o.top+.61],[x+sign*.11,o.top+.70],[x,o.top+.61]]);
        beam(o.id+'-apron-side-'+sign,point(x+sign*.52,.28,.07),point(x+sign*.52,o.bottom-.1,.07),.09,.12,trim);
      }
      beam(o.id+'-crest-stem',point(x,o.top+.05,.10),point(x,o.top+.58,.10),.08,.11,trim);
      beam(o.id+'-pediment-base',point(x-.65,o.top+.06,.07),point(x+.65,o.top+.06,.07),.09,.14,trim);
      relief(o.id+'-apron-rosette',x,.62,.20,.045);
    }
    const leaf=(name:string,u:number,h:number,w:number,height:number,angle:number)=>{
      const shape=new THREE.Shape();shape.moveTo(0,-height/2);shape.bezierCurveTo(-w/2,-height*.2,-w*.42,height*.22,0,height/2);shape.bezierCurveTo(w*.42,height*.22,w/2,-height*.2,0,-height/2);
      const g=new THREE.ExtrudeGeometry(shape,{depth:.028,bevelEnabled:true,bevelThickness:.008,bevelSize:.009,bevelSegments:1,steps:1,curveSegments:5});g.rotateZ(angle);
      const mesh=add(name,g,trim);mesh.position.copy(point(u,h,.075));mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(f.dx,0,f.dz),new THREE.Vector3(0,1,0),outward));
    };
    if(crest){
      const field=new THREE.Shape();field.moveTo(-.64,.08);field.lineTo(-.64,.31);field.bezierCurveTo(-.63,.42,-.47,.40,-.42,.25);field.bezierCurveTo(-.31,.28,-.34,.59,-.19,.66);field.bezierCurveTo(-.10,.73,-.04,.69,0,.63);field.bezierCurveTo(.04,.69,.10,.73,.19,.66);field.bezierCurveTo(.34,.59,.31,.28,.42,.25);field.bezierCurveTo(.47,.40,.63,.42,.64,.31);field.lineTo(.64,.08);field.closePath();
      const backing=add(o.id+'-crest-relief-ground',new THREE.ExtrudeGeometry(field,{depth:.045,bevelEnabled:false,curveSegments:8}),trim);
      backing.position.copy(point(x,o.top,.005));backing.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(f.dx,0,f.dz),new THREE.Vector3(0,1,0),outward));
      relief(o.id+'-crest-flower',x,o.top+.47,.105,.095);
      for(const sign of [-1,1]){
        for(const [i,u,h,a] of [[0,.16,.47,.6],[1,.28,.42,1.05],[2,.45,.22,1.3]] as const)leaf(o.id+'-crest-leaf-'+sign+'-'+i,x+sign*u,o.top+h,.16,.30,-sign*a);
        ring(o.id+'-crest-eye-'+sign,x+sign*.49,o.top+.27,.065,.12,16);
        beam(o.id+'-apron-inner-'+sign,point(x+sign*.42,.34,.04),point(x+sign*.42,o.bottom-.17,.04),.035,.065,trim);
      }
      leaf(o.id+'-crest-crown',x,o.top+.66,.19,.26,0);
      beam(o.id+'-apron-foot',point(x-.58,.24,.07),point(x+.58,.24,.07),.09,.16,trim);
      beam(o.id+'-sill-lower-course',point(x-o.width/2-.1,o.bottom-.15,.07),point(x+o.width/2+.1,o.bottom-.15,.07),.065,.19,trim);
    }
    if(!door&&ornament&&(o.arch||vent)){
      for(const sign of [-1,1])leaf(o.id+'-bracket-leaf-'+sign,x+sign*o.width*.32,o.bottom-.30,.13,.26,-sign*.5);
      leaf(o.id+'-pendant-leaf',x,o.bottom-.44,.15,.22,0);
      beam(o.id+'-sill-underband',point(x-o.width/2-.08,o.bottom-.12,.06),point(x+o.width/2+.08,o.bottom-.12,.06),.045,.17,trim);
    }
    if(!front&&!door&&!o.arch&&!vent){
      const rear=o.id.startsWith('rear-'),mat=rear?rearTrim:trim,w=o.width/2;
      for(const sign of [-1,1])beam(o.id+'-render-jamb-'+sign,point(x+sign*(w+.065),o.bottom,.025),point(x+sign*(w+.065),o.top+.08,.025),.10,.055,mat);
      beam(o.id+'-render-head',point(x-w-.13,o.top+.065,.035),point(x+w+.13,o.top+.065,.035),.12,.075,mat);
      beam(o.id+'-head-cap',point(x-w-.18,o.top+.15,.045),point(x+w+.18,o.top+.15,.045),.055,.12,mat);
      if(rear){
        const bottom=o.bottom-(o.id.includes('-L1-')?.62:.30);
        for(const sign of [-1,1])beam(o.id+'-apron-border-'+sign,point(x+sign*(w-.02),bottom,.025),point(x+sign*(w-.02),o.bottom-.09,.025),.065,.055,mat);
        beam(o.id+'-apron-bottom',point(x-w+.02,bottom,.025),point(x+w-.02,bottom,.025),.065,.055,mat);
      }
    }
    if(door&&o.id.startsWith('street-')){
      const pts=[[x-1.48,4.34],[x,4.98],[x+1.48,4.34]];
      for(let i=0;i<2;i++){beam(o.id+'-portal-coping-'+i,point(pts[i][0],pts[i][1],.38),point(pts[i+1][0],pts[i+1][1],.38),.07,.48,roof);beam(o.id+'-portal-cornice-'+i,point(pts[i][0],pts[i][1]-.09,.39),point(pts[i+1][0],pts[i+1][1]-.09,.39),.075,.45,trim);}
    }
    if(o.id==='street-west-door'&&typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d');
      if(c){
        c.fillStyle='#d9ddd8';c.fillRect(0,0,512,160);c.fillStyle='#778dad';c.fillRect(244,0,268,160);
        c.strokeStyle='#dce0d7';c.lineWidth=5;c.strokeRect(3,3,506,154);c.textAlign='center';
        c.font='bold 54px Georgia';c.fillStyle='#788aa4';c.fillText('SECOND',124,76,234);c.fillStyle='#e2e4d9';c.fillText('HAND',379,76,244);
        c.font='bold 32px Georgia';c.fillStyle='#7c8da3';c.fillText('ДЕШЕВАЯ',124,130,232);c.fillStyle='#e1e4db';c.fillText('ОДЕЖДА',379,130,240);
        const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const mat=surface('SECOND HAND sign',0xffffff,.9);mat.map=t;const sign=add(o.id+'-sign',new THREE.BoxGeometry(1.18,.36,.012),mat);sign.position.copy(point(x,3.02,-.205));sign.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(f.dx,0,f.dz),new THREE.Vector3(0,1,0),outward));}
    }
    if(vent){
      for(let h=o.bottom+.08;h<o.top-.04;h+=.09)beam(o.id+'-louver-'+h,point(x-o.width/2+.04,h,-.22),point(x+o.width/2-.04,h,-.22),.035,.08,wood);
    }else if(!front&&!door){
      beam(o.id+'-mullion',point(x,o.bottom+.04,-.25),point(x,o.top-o.arch-.04,-.25),.045,.07,m);
      if(!o.arch)beam(o.id+'-upper-transom',point(x-o.width/2+.04,o.top-.40,-.25),point(x+o.width/2-.04,o.top-.40,-.25),.045,.07,m);
    }
    if(o.id==='northwest-L1'||o.id==='rear-L1-5'){
      const panel=add(o.id+'-boarded-panel',new THREE.BoxGeometry(o.width-.09,o.top-o.bottom-.09,.02),brown);
      panel.position.copy(point(x,cy,-.29));panel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(f.dx,0,f.dz),new THREE.Vector3(0,1,0),outward));
      for(let u=x-o.width/2+.17;u<x+o.width/2-.06;u+=.16)beam(o.id+'-board-joint-'+u,point(u,o.bottom+.05,-.275),point(u,o.top-.05,-.275),.006,.008,wood);
    }
    if(front&&door){
      const stairs=root.children.filter(n=>n.name===o.id+'-landing'||n.name.startsWith(o.id+'-step-')).map(n=>{
        const box=new THREE.Box3().setFromObject(n),centre=box.getCenter(new THREE.Vector3());
        return {d:(centre.x+context.frame.origin[0]-o.a[0]-f.dx*x)*f.nx+(centre.z+context.frame.origin[1]-o.a[1]-f.dz*x)*f.nz,h:box.max.y+context.frame.base-datum};
      }).sort((a,b)=>a.d-b.d);
      const end=stairs.at(-1)!;
      for(const sign of [-1,1]){
        const u=x+sign*(o.width/2+.19),anchors=[{d:.12,h:o.bottom},{d:.88,h:o.bottom},...(end.d>1?[end]:[])];
        for(const [i,a] of anchors.entries())beam(o.id+'-rail-post-'+sign+'-'+i,point(u,a.h-.015,a.d),point(u,a.h+.92,a.d),.035,.035,rail);
        for(let i=0;i<anchors.length-1;i++){const a=anchors[i],b=anchors[i+1];beam(o.id+'-handrail-'+sign+'-'+i,point(u,a.h+.92,a.d),point(u,b.h+.92,b.d),.035,.035,rail);}
      }
    }
    const spring=o.top-o.arch;
    if(!door&&o.arch&&front){
      const shape=new THREE.Shape(),r=o.width/2-.045,h=o.arch-.045;shape.moveTo(-r,0);shape.lineTo(r,0);for(let j=1;j<=16;j++){const a=j*Math.PI/16;shape.lineTo(r*Math.cos(a),h*Math.sin(a));}shape.closePath();
      const panel=add(o.id+'-fanlight',new THREE.ShapeGeometry(shape),fanlight);panel.position.copy(point(x,spring,-.298));panel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(f.dx,0,f.dz),new THREE.Vector3(0,1,0),outward));
      for(const sign of [-2,-1,0,1,2]){const u=r*sign/3,top=spring+h*Math.sqrt(1-u*u/(r*r));beam(o.id+'-fanlight-rib-'+sign,point(x+u,spring+.02,-.28),point(x+u,top-.015,-.28),.016,.018,frame);}
    }

    beam(o.id+'-transom',point(x-o.width/2,spring,-.25),point(x+o.width/2,spring,-.25),.055,.07,m);
    beam(o.id+'-sill',point(x-o.width/2-.14,o.bottom-.035,.055),point(x+o.width/2+.14,o.bottom-.035,.055),.10,.28,trim);
    if(door){
      beam(o.id+'-leaf-joint',point(x,o.bottom,-.305),point(x,spring,-.305),.028,.04,wood);
      const pullX=x+.12,low=o.bottom+1.02,high=low+.34,mat=front?hardware:iron;
      for(const [i,h] of [low,high].entries()){
        beam(o.id+'-handle-seat-'+i,point(pullX,h-.035,-.305),point(pullX,h+.035,-.305),.055,.045,mat);
        beam(o.id+'-handle-standoff-'+i,point(pullX,h,-.31),point(pullX,h,-.16),.025,.025,mat);
      }
      pipe(o.id+'-handle',[point(pullX,low,-.21),point(pullX+.055,low+.025,-.15),point(pullX+.055,high-.025,-.15),point(pullX,high,-.21)],.012,mat);
      beam(o.id+'-lock-plate',point(pullX-.075,low+.08,-.313),point(pullX-.075,low+.17,-.313),.035,.025,mat);
      beam(o.id+'-key-slot',point(pullX-.075,low+.11,-.297),point(pullX-.075,low+.14,-.297),.005,.008,wood);
      if(front||side)for(const side of [-1,1])for(const h of [1.1,2.1]){const cx=x+side*o.width*.24,w=o.width*.37;
        for(const [a,b] of [[[cx-w/2,h-.32],[cx+w/2,h-.32]],[[cx+w/2,h-.32],[cx+w/2,h+.32]],[[cx+w/2,h+.32],[cx-w/2,h+.32]],[[cx-w/2,h+.32],[cx-w/2,h-.32]]])beam(o.id+`-panel-${side}-${h}-${a}`,point(a[0],a[1],-.3075),point(b[0],b[1],-.3075),.025,.035,wood);
      }
    }else if(crest){
      for(let i=-2;i<=2;i++)beam(o.id+'-bar-'+i,point(x+i*o.width/6,o.bottom+.08,-.08),point(x+i*o.width/6,o.top-.08,-.08),.018,.018,iron);
      for(let h=o.bottom+.28;h<o.top-.10;h+=.36)beam(o.id+'-crossbar-'+h,point(x-o.width/2+.06,h,-.08),point(x+o.width/2-.06,h,-.08),.018,.018,iron);
    }
  }
  // Collinear overlapping facet edges are interior tessellation, not roof trim.
  const validRoofs=roofPolygons.filter(p=>{const a=new THREE.Vector3(...p[0]);return p.slice(1,-1).some((b,i)=>new THREE.Vector3(...b).sub(a).cross(new THREE.Vector3(...p[i+2]).sub(a)).lengthSq()>1e-10);});
  const edges=validRoofs.flatMap(p=>p.map((a,i)=>({a,b:p[(i+1)%p.length]})));
  let index=0;
  for(const e of edges){
    const a=new THREE.Vector3(e.a[0],e.a[2],e.a[1]),b=new THREE.Vector3(e.b[0],e.b[2],e.b[1]),v=b.clone().sub(a),l2=v.lengthSq();if(l2<1e-8)continue;
    const covered:number[][]=[];
    for(const other of edges){if(other===e)continue;const c=new THREE.Vector3(other.a[0],other.a[2],other.a[1]).sub(a),d=new THREE.Vector3(other.b[0],other.b[2],other.b[1]).sub(a);
      if(c.clone().cross(v).lengthSq()>l2*1e-8||d.clone().cross(v).lengthSq()>l2*1e-8)continue;
      const p=c.dot(v)/l2,q=d.dot(v)/l2,lo=Math.max(0,Math.min(p,q)),hi=Math.min(1,Math.max(p,q));if(hi-lo>1e-6)covered.push([lo,hi]);
    }
    const cuts=[0,1,...covered.flat()].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const lo=cuts[i],hi=cuts[i+1],mid=(lo+hi)/2;if(hi-lo<1e-6||covered.some(([l,h])=>mid>=l&&mid<=h))continue;
      const p=a.clone().addScaledVector(v,lo),q=a.clone().addScaledVector(v,hi);
      const edge=footprint.map((c,j)=>{const d=footprint[(j+1)%footprint.length],l=Math.hypot(d[0]-c[0],d[1]-c[1]);return {c,nx:-(d[1]-c[1])/l,nz:(d[0]-c[0])/l};}).find(f=>[p,q].every(t=>Math.abs((t.x-f.c[0])*f.nx+(t.z-f.c[1])*f.nz)<.06));
      if(!edge)continue;outward.set(edge.nx,0,edge.nz);
      for(const [j,depth,h,drop] of [[0,.22,.07,-.015],[1,.16,.11,.12],[2,.10,.075,.23]]){
        const pt=(t:THREE.Vector3)=>world(t.x+edge.nx*(depth/2-.025),t.z+edge.nz*(depth/2-.025),t.y-14.41-drop);
        beam(`cornice-${index}-${j}`,pt(p),pt(q),h,depth,j===0?roof:trim);
      }
      if(Math.abs(p.y-q.y)<.015){
        const a=world(p.x+edge.nx*.27,p.z+edge.nz*.27,p.y-14.41-.075),b=world(q.x+edge.nx*.27,q.z+edge.nz*.27,q.y-14.41-.075);
        const tangent=b.clone().sub(a).normalize(),normal=new THREE.Vector3(edge.nx,0,edge.nz),up=new THREE.Vector3(0,1,0),vertices:number[]=[];
        const pt=(at:THREE.Vector3,t:number,r:number)=>at.clone().addScaledVector(normal,Math.cos(t)*r).addScaledVector(up,-Math.sin(t)*r);
        const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
        for(let j=0;j<8;j++){const t=j*Math.PI/8,u=(j+1)*Math.PI/8;for(const [radius,flip] of [[.09,0],[.075,1]]){const points=[pt(a,t,radius),pt(b,t,radius),pt(b,u,radius),pt(a,u,radius)];if(flip)points.reverse();tri(points[0],points[1],points[2]);tri(points[0],points[2],points[3]);}}
        for(const end of [a,b])for(let j=0;j<8;j++){const t=j*Math.PI/8,u=(j+1)*Math.PI/8,points=[pt(end,t,.09),pt(end,u,.09),pt(end,u,.075),pt(end,t,.075)];if(end===a)points.reverse();tri(points[0],points[1],points[2]);tri(points[0],points[2],points[3]);}
        for(const t of [0,Math.PI]){const p0=pt(a,t,.09),p1=pt(b,t,.09),p2=pt(b,t,.075),p3=pt(a,t,.075);tri(p0,p1,p2);tri(p0,p2,p3);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add('gutter-'+index,g,fold);
      }index++;
    }
  }
  const local=(u:number,v:number,h:number)=>world(302.4+dx*u+dz*v,555.92+dz*u-dx*v,h);
  for(const [i,u,v,h] of [[0,.08,-.14,11.15],[1,L-.08,-.14,11.15],[2,9.31,1.12,8.04],[3,L-9.31,1.12,8.04]]){
    pipe('downpipe-'+i,[local(u,v-.12,h),local(u,v-.10,h-.22),local(u,v,h-.45),local(u,v,.5),local(u,v-.22,.26)],.055,fold);
    outward.set(dz,0,-dx);for(let y=1.;y<h-.6;y+=2.5)beam('pipe-fixing-'+i+'-'+y,local(u,(i<2?0:1.3)+.015,y),local(u,v-.04,y),.025,.025,iron);
  }
  for(const [i,u] of [10.6,17.6,23.2].entries()){
    const corners=[[u-.49,8.96],[u+.49,8.96],[u+.49,9.89],[u-.49,9.89]],positions:number[]=[];
    const apex=local(u,9.425,14.24),under=local(u,9.425,14.145);
    for(let j=0;j<4;j++){
      const a=local(...corners[j] as [number,number],14.16),b=local(...corners[(j+1)%4] as [number,number],14.16);
      const tri=[a,b,apex];if(b.clone().sub(a).cross(apex.clone().sub(a)).y<0)tri.reverse();
      for(const p of tri)positions.push(...p.toArray());
      const lower=[a.clone().add(new THREE.Vector3(0,-.015,0)),under,b.clone().add(new THREE.Vector3(0,-.015,0))];
      if(lower[1].clone().sub(lower[0]).cross(lower[2].clone().sub(lower[0])).y>0)lower.reverse();
      for(const p of lower)positions.push(...p.toArray());
      outward.set(dz,0,-dx);beam('chimney-cap-hem-'+i+'-'+j,a.clone().add(new THREE.Vector3(0,-.015,0)),b.clone().add(new THREE.Vector3(0,-.015,0)),.035,.025,fold);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add('chimney-cap-'+i,g,fold);
    for(const side of [-1,1])beam('chimney-cap-support-'+i+'-'+side,local(u+side*.24,9.425,13.98),local(u+side*.24,9.425,14.18),.035,.035,roof);
    for(const side of [-1,1]){
      for(const v of [9.09,9.76])beam('chimney-corner-fold-'+i+'-'+side+'-'+v,local(u+side*.35,v,12.58),local(u+side*.35,v,13.99),.018,.025,fold);
      beam('chimney-sheet-joint-'+i+'-'+side,local(u,9.425+side*.334,12.58),local(u,9.425+side*.334,13.99),.012,.018,fold);
    }
  }
  const roofLevel=(u:number,v:number)=>{
    const p=local(u,v,0),x=p.x+context.frame.origin[0],z=p.z+context.frame.origin[1];let height=-Infinity;
    for(const poly of roofPolygons)for(let i=1;i<poly.length-1;i++){const [a,b,c]=[poly[0],poly[i],poly[i+1]],det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-8)continue;const t=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/det,w=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/det;if(Math.min(t,w,1-t-w)>=-1e-6)height=Math.max(height,t*a[2]+w*b[2]+(1-t-w)*c[2]-14.41);}return height;
  };
  for(const [i,u] of [10.6,17.6,23.2].entries()){
    const inside=[[u-.35,9.1],[u+.35,9.1],[u+.35,9.75],[u-.35,9.75]],outside=[[u-.55,8.9],[u+.55,8.9],[u+.55,9.95],[u-.55,9.95]],vertices:number[]=[];
    for(let j=0;j<4;j++){const k=(j+1)%4,a=local(...outside[j] as [number,number],roofLevel(...outside[j] as [number,number])+.025),b=local(...outside[k] as [number,number],roofLevel(...outside[k] as [number,number])+.025),c=local(...inside[k] as [number,number],roofLevel(...inside[k] as [number,number])+.18),d=local(...inside[j] as [number,number],roofLevel(...inside[j] as [number,number])+.18);for(const p of [a,b,c,a,c,d])vertices.push(...p.toArray());}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add('chimney-flashing-'+i,g,fold);
  }
  const roofLines:{a:THREE.Vector3;v:THREE.Vector3;intervals:[number,number][]}[]=[];
  for(const {a,b} of edges){
    const p=new THREE.Vector3(a[0],a[2],a[1]),q=new THREE.Vector3(b[0],b[2],b[1]),v=q.clone().sub(p);if(v.length()<.05)continue;v.normalize();
    let line=roofLines.find(l=>Math.abs(l.v.dot(v))>1-1e-7&&p.clone().sub(l.a).cross(l.v).length()<.0001);
    if(!line){line={a:p,v,intervals:[]};roofLines.push(line);}
    const t0=p.clone().sub(line.a).dot(line.v),t1=q.clone().sub(line.a).dot(line.v);line.intervals.push([Math.min(t0,t1),Math.max(t0,t1)]);
  }
  const roofTriangles=validRoofs.flatMap(poly=>poly.slice(1,-1).map((b,i)=>[poly[0],b,poly[i+2]].map(p=>world(p[0],p[1],p[2]-14.41))));
  const sheet=(name:string,vertices:THREE.Vector3[])=>{
    const positions:number[]=[],cross=(a:THREE.Vector3,b:THREE.Vector3,p:THREE.Vector3)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
    for(let i=0;i<vertices.length;i+=3)for(const tri of roofTriangles){
      const [a,b,c]=tri,n=b.clone().sub(a).cross(c.clone().sub(a)),orientation=Math.sign(cross(a,b,c));if(Math.abs(n.y)<1e-8)continue;
      let polygon=vertices.slice(i,i+3).map(p=>p.clone());
      for(let edge=0;edge<3&&polygon.length;edge++){
        const from=tri[edge],to=tri[(edge+1)%3],clipped:THREE.Vector3[]=[];
        for(let j=0;j<polygon.length;j++){
          const p=polygon[j],q=polygon[(j+1)%polygon.length],dp=cross(from,to,p)*orientation,dq=cross(from,to,q)*orientation;
          if(dp>=-1e-9)clipped.push(p);
          if((dp>0&&dq<0)||(dp<0&&dq>0))clipped.push(p.clone().lerp(q,dp/(dp-dq)));
        }
        polygon=clipped;
      }
      if(polygon.length<3)continue;
      for(const p of polygon)p.y=a.y-(n.x*(p.x-a.x)+n.z*(p.z-a.z))/n.y+.02;
      const centre=polygon.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/polygon.length),x=centre.x+context.frame.origin[0],z=centre.z+context.frame.origin[1];
      const top=roofLevel((x-302.4)*dx+(z-555.92)*dz,(x-302.4)*dz-(z-555.92)*dx)+datum-context.frame.base;
      if(centre.y<top+.005)continue;
      for(let j=1;j<polygon.length-1;j++){
        const [p,q,r]=[polygon[0],polygon[j],polygon[j+1]],normal=q.clone().sub(p).cross(r.clone().sub(p));if(normal.lengthSq()<1e-14)continue;
        for(const v of normal.y>0?[p,q,r]:[p,r,q])positions.push(...v.toArray());
      }
    }
    if(!positions.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(name,g,fold);
  };
  let junction=0;
  for(const line of roofLines){
    const ranges:[number,number][]=[];
    for(const range of line.intervals.sort((a,b)=>a[0]-b[0])){const last=ranges.at(-1);if(last&&range[0]<=last[1]+.0001)last[1]=Math.max(last[1],range[1]);else ranges.push([...range]);}
    for(const [lo,hi] of ranges){
      const a=line.a.clone().addScaledVector(line.v,lo),b=line.a.clone().addScaledVector(line.v,hi);
      const au=(a.x-302.4)*dx+(a.z-555.92)*dz,av=(a.x-302.4)*dz-(a.z-555.92)*dx;
      const bu=(b.x-302.4)*dx+(b.z-555.92)*dz,bv=(b.x-302.4)*dz-(b.z-555.92)*dx;
      const len=Math.hypot(bu-au,bv-av);if(len<.2)continue;
      const nu=-(bv-av)/len*.11,nv=(bu-au)/len*.11,steps=Math.ceil(len/.25),vertices:THREE.Vector3[]=[];
      let convex=0,concave=0;
      for(let i=0;i<steps;i++){
        const t0=Math.max(.015/len,i/steps),t1=Math.min(1-.015/len,(i+1)/steps),tm=(t0+t1)/2;
        const u=au+(bu-au)*tm,v=av+(bv-av)*tm,h=roofLevel(u,v),left=roofLevel(u+nu,v+nv),right=roofLevel(u-nu,v-nv),bend=left+right-2*h;
        // Coplanar survey subdivisions must not acquire artificial outline strips.
        if(!Number.isFinite(h+left+right)||Math.abs(bend)<.008||Math.max(Math.abs(left-h),Math.abs(right-h))>.24)continue;
        const rows=[t0,t1].map(t=>{const u=au+(bu-au)*t,v=av+(bv-av)*t;return [-1,0,1].map(sign=>{const pu=u+sign*nu,pv=v+sign*nv;return local(pu,pv,roofLevel(pu,pv)+(sign===0&&bend<0?.026:.018));});});
        if(!rows.flat().every(p=>Number.isFinite(p.y)))continue;
        for(let j=0;j<2;j++)vertices.push(rows[0][j],rows[1][j],rows[1][j+1],rows[0][j],rows[1][j+1],rows[0][j+1]);
        if(bend<0)convex++;else concave++;
      }
      if(vertices.length)sheet((convex>=concave?'hip-ridge-fold-':'valley-lining-')+junction++,vertices);
    }
  }
  for(const [id,u,front,back] of [['street',L/2,3.4,5.75],['rear-west',7,15.55,13.8],['rear-east',27,15.55,13.8]] as const){
    const v0=Math.min(front,back),v1=Math.max(front,back),corners=[[u-.7,v0],[u+.7,v0],[u+.7,v1],[u-.7,v1]],outer=[[u-.85,v0-.15],[u+.85,v0-.15],[u+.85,v1+.15],[u-.85,v1+.15]];
    for(let j=0;j<4;j++){
      const k=(j+1)%4,vertices:THREE.Vector3[]=[];
      for(let n=0;n<12;n++){
        const points=[n/12,(n+1)/12].map(t=>[corners,outer].map(loop=>{const a=loop[j],b=loop[k],pu=a[0]+(b[0]-a[0])*t,pv=a[1]+(b[1]-a[1])*t;return local(pu,pv,roofLevel(pu,pv)+.022);}));
        if(!points.flat().every(p=>Number.isFinite(p.y)))continue;
        vertices.push(points[0][0],points[1][0],points[1][1],points[0][0],points[1][1],points[0][1]);
      }
      if(vertices.length)sheet('dormer-apron-'+id+'-'+j,vertices);
    }
    for(const sign of [-1,1]){
      const vertices:THREE.Vector3[]=[];
      for(let n=0;n<12;n++){
        const vA=v0+(v1-v0)*n/12,vB=v0+(v1-v0)*(n+1)/12,pu=u+sign*.705;
        const a=local(pu,vA,roofLevel(pu,vA)+.018),b=local(pu,vB,roofLevel(pu,vB)+.018),c=b.clone().add(new THREE.Vector3(0,.09,0)),d=a.clone().add(new THREE.Vector3(0,.09,0));
        const points=sign>0?[a,b,c,a,c,d]:[a,c,b,a,d,c];vertices.push(...points);
      }
      if(vertices.every(p=>Number.isFinite(p.y))){const positions=vertices.flatMap(p=>p.toArray()),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add('dormer-side-flashing-'+id+'-'+sign,g,fold);}
    }
  }
  const dormers=[['street',L/2,3.45,9.45,10.05,-1],['rear-west',7,15.48,9.52,10.03,1],['rear-east',27,15.48,9.52,10.03,1]] as const;
  for(const [id,u,v,lo,hi,sign] of dormers){
    outward.set(dz*sign,0,-dx*sign);
    for(const side of [-1,1])beam('dormer-frame-'+id+'-'+side,local(u+side*.285,v,lo),local(u+side*.285,v,hi),.04,.055,brown);
    for(const h of [lo+.02,hi-.02])beam('dormer-frame-'+id+'-'+h,local(u-.30,v,h),local(u+.30,v,h),.04,.055,brown);
    for(let j=0;j<6;j++){
      const h=lo+.065+j*(hi-lo-.12)/5;
      beam('dormer-louver-'+id+'-'+j,local(u-.265,v+sign*.012,h),local(u+.265,v+sign*.012,h),.042,.065,wood);
    }
    beam('dormer-sill-drip-'+id,local(u-.34,v+sign*.025,lo-.015),local(u+.34,v+sign*.025,lo-.015),.035,.10,fold);
  }
  outward.set(-dx,0,-dz);
  pipe('northwest-rear-downpipe',[local(-.18,17.75,8.05),local(-.18,17.75,7.78),local(-.08,17.75,7.52),local(-.08,17.75,.4),local(-.3,17.75,.22)],.05,fold);
  for(const h of [1,3.5,6,7.5])beam('northwest-pipe-clip-'+h,local(.01,17.75,h),local(-.14,17.75,h),.025,.025,iron);
  tube('northwest-service-cable',[local(-.045,10.15,.3),local(-.045,10.15,3.7),local(-.045,10.1,4.1),local(-.045,9.8,4.3),local(-.045,8.1,4.38)],.012,iron);
  outward.set(-dz,0,dx);
  for(const u of [16.84,17.66])beam('tower-door-jamb-'+u,local(u,20.045,.2),local(u,20.045,2.23),.055,.06,wood);
  beam('tower-door-head',local(16.84,20.045,2.22),local(17.66,20.045,2.22),.055,.06,wood);
  beam('tower-door-handle',local(17.53,20.085,1),local(17.53,20.085,1.23),.022,.025,iron);
  for(const h of [1,1.23])beam('tower-door-handle-seat-'+h,local(17.53,20.015,h),local(17.53,20.09,h),.035,.035,iron);
  const towerArc=Array.from({length:33},(_,i)=>local(17.25+2*Math.cos(i*Math.PI/32),18.3+2*Math.sin(i*Math.PI/32),6.69));
  // Straight segments retain the approved faceted seating rather than cutting a curved trim through it.
  for(let i=0;i<towerArc.length-1;i++)beam('tower-drip-'+i,towerArc[i],towerArc[i+1],.055,.075,fold);
  for(const u of [15.25,19.25])beam('tower-side-drip-'+u,local(u,17.65,6.69),local(u,18.3,6.69),.055,.075,fold);
  const tower=root.getObjectByName('rear-stairwell-roof') as THREE.Mesh;
  root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),flashing:number[]=[];
  for(let i=0;i<32;i++){
    const points:THREE.Vector3[]=[];
    for(const u of [15.26+3.98*i/32,15.26+3.98*(i+1)/32]){
      const at=local(u,17.91,20);ray.set(at,new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(tower)[0];
      if(hit)points.push(hit.point.clone().add(new THREE.Vector3(0,-.01,0)),hit.point.clone().add(new THREE.Vector3(0,.15,0)));
    }
    if(points.length===4)for(const j of [0,3,2,0,1,3])flashing.push(...points[j].toArray());
  }
  if(flashing.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(flashing,3));g.computeVertexNormals();add('tower-wall-counterflashing',g,fold);}
  root.userData.audit={...root.userData.audit,stage:'refinement in progress',corniceSegments:index};
  return {root,setTextures(enabled){detail.value=enabled?1:0;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());shell.dispose();}};
}
