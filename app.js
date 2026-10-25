import {orbitStep,orbitOffset,unwrapAngle,MIN_ELEVATION,MAX_ELEVATION} from './camera-orbit.js';
import * as THREE from 'three';
import {fitCameraDepth} from './camera-depth.js';
import {shadowCoverage,useBuildingShadowDetail} from './shadow-coverage.js';
import {addKesk1,carveKesk1Ground,carveGroundPatches} from './kesk1.js';
import {addTrees} from './trees.js';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=s=>document.querySelector(s),view=$('#view');
try{await start();}catch(e){$('#error').hidden=false;$('#error').textContent='The town could not start: '+e.message;console.error(e);}
async function start(){
const [data,buffer]=await Promise.all([fetch('./scene.json').then(r=>r.json()),fetch('./geometry.bin.gz').then(r=>new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())]);data.vertices=carveKesk1Ground(new Float32Array(buffer),data.buildings.find(b=>b.id==='213321385'));const scene=new THREE.Scene();scene.background=new THREE.Color('#e0e6d9');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;view.append(renderer.domElement);
const camera=new THREE.OrthographicCamera(),controls=new OrbitControls(camera,renderer.domElement);controls.enableRotate=false;controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN};controls.screenSpacePanning=false;controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.04;controls.maxZoom=12;controls.maxPolarAngle=Math.PI/2-MIN_ELEVATION;controls.minPolarAngle=0;let span=108;
function resize(){let a=innerWidth/innerHeight;camera.left=-span*a/2;camera.right=span*a/2;camera.top=span/2;camera.bottom=-span/2;camera.near=.1;camera.far=15000;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
scene.add(new THREE.HemisphereLight('#e6efff','#73775c',1.1));const sun=new THREE.DirectionalLight('#fff1d4',2.4);sun.position.set(-55,100,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-145,right:145,top:145,bottom:-145,near:1,far:320});sun.shadow.bias=-.0001;sun.shadow.normalBias=.04;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);
let shadowCentre=new THREE.Vector3(1e9,0,0),sunOffset=new THREE.Vector3(-180,300,-100),shadowWidth=0;
function updateShadow(){
  const building=data.buildings.find(b=>b.id==='213321385'),anchor=new THREE.Vector3(building.c[0]-750,6,building.c[1]-760);
  const detail=useBuildingShadowDetail(camera,controls.target,anchor);
  const centre=detail?anchor:controls.target,radius=detail?100:shadowCoverage(camera,controls.target);
  const mapSize=detail?4096:2048;if(sun.shadow.mapSize.x!==mapSize){sun.shadow.mapSize.set(mapSize,mapSize);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;}
  // A 600 m depth range made the old detail bias detach shadows by 15 cm.
  // Keep the detail receiver offset below the thin apron/foundation contact.
  sun.shadow.bias=detail?-.00004:-.0005;sun.shadow.normalBias=detail?.06:.22;
  if(shadowCentre.distanceTo(centre)>(detail?.01:25)||Math.abs(shadowWidth-radius)>20){shadowCentre.copy(centre);shadowWidth=radius;sun.target.position.copy(shadowCentre);sun.position.copy(shadowCentre).addScaledVector(sunOffset.clone().normalize(),radius+200);Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:1,far:2*radius+400});sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;}
}

let seed=17;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function texture(kind){let c=document.createElement('canvas');c.width=c.height=256;let x=c.getContext('2d');x.fillStyle='#eeeae2';x.fillRect(0,0,256,256);for(let i=0;i<14000;i++){let n=kind==='grass'?150+rng()*95:205+rng()*48;x.fillStyle=`rgb(${n},${n},${n})`;x.globalAlpha=kind==='plaster'?.16:.25;x.fillRect(rng()*256,rng()*256,1+rng()*2,1+rng()*2);}x.globalAlpha=1;
if(['brick','stone','paving'].includes(kind)){let h=kind==='roof'?32:kind==='stone'?64:40,w=kind==='stone'?100:80;for(let row=0;row<256/h;row++){for(let col=-1;col<5;col++){let xx=col*w+(row%2)*w/2,yy=row*h;let shade=210+rng()*35;x.fillStyle=`rgb(${shade},${shade},${shade})`;x.fillRect(xx+1,yy+1,w-2,h-2);x.strokeStyle=kind==='roof'?'#969b98':'#b8b7af';x.lineWidth=kind==='stone'?3:1.5;x.strokeRect(xx,yy,w,h);x.strokeStyle='#f2efe5';x.beginPath();x.moveTo(xx+2,yy+2);x.lineTo(xx+w-2,yy+2);x.stroke();}}}
if(kind==='roof'){x.fillStyle='#e1e4e1';x.fillRect(0,0,256,256);for(let j=0;j<256;j+=32){x.fillStyle='#a2aaa8';x.fillRect(j,0,2,256);x.fillStyle='#f0f1ec';x.fillRect(j+2,0,1,256);}x.fillStyle='#bec5c1';x.fillRect(0,127,256,1);}
let t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
let textures={},materials={};for(let kind of ['plaster','roof','stone','paving','clay','grass','brick','plain','glass','water']){let t=texture(kind);textures[kind]=t;materials[kind]=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,shadowSide:THREE.FrontSide,map:kind==='plain'||kind==='glass'?null:t,bumpMap:['plaster','roof','stone','brick'].includes(kind)?t:null,bumpScale:kind==='plaster'?.025:.065,roughness:kind==='glass'?.3:.94,metalness:kind==='glass'?.12:0});}
const distantMaterials=Object.fromEntries(Object.entries(materials).map(([k,m])=>[k,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,map:null})]));
// Retain the actual local rendered ground for the thin perimeter apron.
const localBuilding=data.buildings.find(b=>b.id==='213321385'),minX=Math.min(...localBuilding.g.map(p=>p[0]))-15,maxX=Math.max(...localBuilding.g.map(p=>p[0]))+15,minZ=Math.min(...localBuilding.g.map(p=>p[1]))-15,maxZ=Math.max(...localBuilding.g.map(p=>p[1]))+15;
data.terrain.kesk1GroundTriangles=[];
for(let i=0;i<data.vertices.length;i+=21){const v=data.vertices;if(v[i+6]!==0)continue;const xs=[v[i],v[i+7],v[i+14]],zs=[v[i+1],v[i+8],v[i+15]];if(Math.max(...xs)<minX||Math.min(...xs)>maxX||Math.max(...zs)<minZ||Math.min(...zs)>maxZ)continue;data.terrain.kesk1GroundTriangles.push([v[i],v[i+1],v[i+2],v[i+7],v[i+8],v[i+9],v[i+14],v[i+15],v[i+16]]);}
const refinedKesk1=addKesk1(scene,data.buildings.find(b=>b.id==='213321385'),data.terrain);
data.vertices=carveGroundPatches(data.vertices,refinedKesk1.userData.groundPatches);
const buckets=new Map(),v=data.vertices;let c=new THREE.Color(),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3(),normal=new THREE.Vector3();
for(let i=0;i<v.length;i+=21){if(v[i+6]===276)continue;let pts=[0,14,7].map(j=>new THREE.Vector3(v[i+j]-750,v[i+j+2]-data.base,v[i+j+1]-760));a.subVectors(pts[1],pts[0]);b.subVectors(pts[2],pts[0]);normal.crossVectors(a,b);let area=normal.length()/2;normal.normalize();if(Math.abs(normal.y)>.2&&normal.y<0){[pts[1],pts[2]]=[pts[2],pts[1]];normal.negate();}let r=v[i+3],g=v[i+4],bl=v[i+5],id=v[i+6],mean=(r+g+bl)/3,sat=Math.max(r,g,bl)-Math.min(r,g,bl),y=pts.reduce((s,p)=>s+p.y,0)/3;
let kind='plain';if(id){if(bl>r*1.04&&g>r*1.04)kind='glass';else if(Math.abs(normal.y)>.15&&y>4&&mean<.65)kind='roof';else if(area>1&&Math.abs(normal.y)<.2)kind=mean<.62&&sat<.1?'stone':r>g*1.3?'brick':'plaster';}
else if(bl>r*1.15&&g>r*1.15){kind='water';}else if(area>2||(pts[0].x+750>=minX&&pts[0].x+750<=maxX&&pts[0].z+760>=minZ&&pts[0].z+760<=maxZ)){kind=g>r*1.035?'grass':r>g*1.2?'clay':sat<.1?'paving':'grass';}
let detail=id&&kind!=='glass'&&area<.16?'fine':id&&kind!=='glass'&&area<1?'medium':'base';let cx=Math.floor((pts[0].x+pts[1].x+pts[2].x)/3/180),cz=Math.floor((pts[0].z+pts[1].z+pts[2].z)/3/180),key=kind+'-'+detail+'-'+cx+'-'+cz;if(!buckets.has(key))buckets.set(key,{kind,detail,cell:cx+','+cz,p:[],c:[],uv:[]});let out=buckets.get(key),tile={roof:2.4,plaster:2,stone:2.2,brick:1.8,paving:3,grass:2,clay:1.5}[kind]||2;
for(let j=0;j<3;j++){let p=pts[j],k=[0,14,7][j];out.p.push(p.x,p.y,p.z);c.setRGB(v[i+k+3],v[i+k+4],v[i+k+5],THREE.SRGBColorSpace);out.c.push(c.r,c.g,c.b);let ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);out.uv.push((ay>ax&&ay>az?p.x:ax>az?p.z:p.x)/tile,(ay>ax&&ay>az?p.z:p.y)/tile);}}
const detailGroups={base:new THREE.Group(),medium:new THREE.Group(),fine:new THREE.Group()};Object.values(detailGroups).forEach(g=>scene.add(g));for(let out of buckets.values()){let geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(out.p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(out.c,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(out.uv,2));geo.computeVertexNormals();geo.computeBoundingSphere();let m=new THREE.Mesh(geo,materials[out.kind]);m.castShadow=out.detail==='base'&&out.kind!=='grass'&&out.kind!=='paving'&&out.kind!=='clay';m.receiveShadow=out.detail==='base';m.userData.kind=out.kind;detailGroups[out.detail].add(m);}
const overviewGroup=new THREE.Group(),overviewBuckets=new Map(),overviewMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
for(const out of buckets.values()){if(out.detail!=='base')continue;if(!overviewBuckets.has(out.cell))overviewBuckets.set(out.cell,{p:[],c:[]});const dest=overviewBuckets.get(out.cell);for(const n of out.p)dest.p.push(n);for(const n of out.c)dest.c.push(n);}
for(const out of overviewBuckets.values()){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(out.p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(out.c,3));geo.computeVertexNormals();geo.computeBoundingSphere();overviewGroup.add(new THREE.Mesh(geo,overviewMaterial));}scene.add(overviewGroup);overviewGroup.visible=false;buckets.clear();overviewBuckets.clear();
const vegetation=new THREE.Group();scene.add(vegetation);
const forest=addTrees(vegetation,data.trees,[750,760],data.base);
let redraw=true;controls.addEventListener('change',()=>redraw=true);for(const event of ['input','change','click','resize'])addEventListener(event,()=>redraw=true);
let textured=true,level=-1,rotation=null,measure=null,last=performance.now(),samples=[];
function focus(which){let presets={front:{t:[7,7,8],p:[-102,89,55],s:118},side:{t:[12,7,12],p:[-63,47,105],s:66},wide:{t:[850,0,140],p:[850,2600,2140],s:Math.max(2000,3400/(innerWidth/innerHeight))*1.1},east:{t:[1500,0,400],p:[1050,520,940],s:750}};let p=presets[which];controls.target.fromArray(p.t);camera.position.fromArray(p.p);span=p.s;camera.zoom=1;resize();controls.update();document.querySelectorAll('.buttons button').forEach(b=>b.classList.toggle('active',b.id===which));}
function focusBuilding(b){rotation=null;const target=new THREE.Vector3(b.c[0]-750,6,b.c[1]-760);controls.target.copy(target);camera.position.copy(target).add(b.id==='213321385'?new THREE.Vector3(110,80,45):new THREE.Vector3(-110,110,130));span=b.id==='213321385'?65:120;camera.zoom=1;resize();controls.update();$('#search').value=b.name;redraw=true;}
// Temporary review default requested by Anton. Search still selects any building.
focusBuilding(data.buildings.find(b=>b.id==='213321385'));
function currentOrbit(){const v=camera.position.clone().sub(controls.target);return {theta:unwrapAngle(Math.atan2(v.x,v.z),rotation?.currentTheta??rotation?.from.theta),elevation:Math.atan2(v.y,Math.hypot(v.x,v.z)),radius:v.length()};}
function rotate(horizontal=0,vertical=0){const from=currentOrbit(),to=orbitStep(rotation?.to??from,horizontal,vertical);rotation={from,to,start:performance.now()};measure=null;redraw=true;}
$('#rotate').onclick=()=>rotate(1);$('#rotate-back').onclick=()=>rotate(-1);
$('#tilt-up').onclick=()=>rotate(0,1);$('#tilt-down').onclick=()=>rotate(0,-1);
controls.addEventListener('start',()=>rotation=null);
$('#textures').onchange=e=>{textured=e.target.checked;refinedKesk1.userData.setTextures(textured);for(let [k,m] of Object.entries(materials)){m.map=textured&&!['plain','glass'].includes(k)?textures[k]:null;m.bumpMap=textured&&['plaster','roof','stone','brick'].includes(k)?textures[k]:null;m.needsUpdate=true;}};
$('#shadows').onchange=e=>{renderer.shadowMap.enabled=e.target.checked;scene.traverse(o=>{if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.needsUpdate=true;});renderer.shadowMap.needsUpdate=true;redraw=true;};
$('#sun').oninput=e=>{let k=+e.target.value/100;sunOffset.set(-280+560*k,150+200*Math.sin(k*Math.PI),-100);shadowCentre.set(1e9,0,0);sun.color.set(k<.25?'#ffd2a0':k>.8?'#ffd6ac':'#fff1dc');sun.intensity=2+Math.sin(k*Math.PI)*.4;renderer.shadowMap.needsUpdate=true;$('#time').textContent=k<.3?'Morning':k>.75?'Late afternoon':'Afternoon';};
if($('#measure')) $('#measure').onclick=()=>{measure={start:performance.now(),frames:[],base:camera.position.clone(),target:controls.target.clone()};$('#performance').textContent='Measuring 4 seconds of camera movement…';};
function updateLOD(){let ppm=innerHeight*camera.zoom/span,next=ppm>5?2:ppm>1.8?1:0;if(next===level)return;level=next;overviewGroup.visible=level===0;detailGroups.base.visible=level>0;for(const group of Object.values(detailGroups))for(const mesh of group.children)mesh.material=level===0?distantMaterials[mesh.userData.kind]:materials[mesh.userData.kind];detailGroups.fine.visible=level===2;detailGroups.medium.visible=level>=1;renderer.shadowMap.needsUpdate=true;$('#status').textContent=['Overview detail','Neighbourhood detail','Close-up detail'][level];}
function frame(now){requestAnimationFrame(frame);let dt=now-last;last=now;if(rotation){let k=Math.min(1,(now-rotation.start)/500),u=k*k*(3-2*k),from=rotation.from,to=rotation.to;
const orbit={theta:from.theta+(to.theta-from.theta)*u,elevation:from.elevation+(to.elevation-from.elevation)*u,radius:from.radius+(to.radius-from.radius)*u};
rotation.currentTheta=orbit.theta;camera.position.copy(controls.target).add(new THREE.Vector3(...orbitOffset(orbit)));redraw=true;if(k===1)rotation=null;}

if(measure){let k=(now-measure.start)/1000;measure.frames.push(dt);let v=measure.base.clone().sub(measure.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.sin(k*1.5)*.14);camera.position.copy(measure.target).add(v);if(k>=4){let a=measure.frames.slice(2),mean=a.reduce((x,y)=>x+y,0)/a.length;$('#performance').textContent=(1000/mean).toFixed(0)+' FPS observed · '+renderer.info.render.calls+' draw calls · '+Math.round(renderer.info.render.triangles/1000)+'k triangles · '+['overview','neighbourhood','close-up'][level]+' detail';camera.position.copy(measure.base);measure=null;}}
controls.update();const elevation=(rotation?.to??currentOrbit()).elevation;
$('#tilt-up').disabled=elevation>=MAX_ELEVATION-2e-6;$('#tilt-down').disabled=elevation<=MIN_ELEVATION+1e-6;
if(redraw||rotation||measure){updateLOD();if(forest.update(controls.target,innerHeight*camera.zoom/span))renderer.shadowMap.needsUpdate=true;updateShadow();fitCameraDepth(camera,controls.target);renderer.render(scene,camera);redraw=false;}}
const search=$('#search'),results=$('#results');
search.oninput=()=>{results.replaceChildren();let q=search.value.toLocaleLowerCase().trim();results.hidden=!q;if(!q)return;data.buildings.filter(b=>b.name.toLocaleLowerCase().includes(q)).slice(0,12).forEach(b=>{let button=document.createElement('button');button.textContent=b.name;button.onclick=()=>{focusBuilding(b);results.hidden=true;};results.append(button);});};
// Hover against individual building bounds; never leave a pinned label behind.
const pointer=new THREE.Vector2(),ray=new THREE.Raycaster(),boxes=data.buildings.map(b=>({b,box:new THREE.Box3(new THREE.Vector3(Math.min(...b.g.map(p=>p[0]))-750,-data.base,Math.min(...b.g.map(p=>p[1]))-760),new THREE.Vector3(Math.max(...b.g.map(p=>p[0]))-750,b.h+20,Math.max(...b.g.map(p=>p[1]))-760))}));let hoverTimer;
renderer.domElement.addEventListener('pointermove',e=>{clearTimeout(hoverTimer);$('#tooltip').hidden=true;if(e.buttons)return;hoverTimer=setTimeout(()=>{pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,camera);let nearest=null,distance=Infinity;for(const item of boxes){let hit=ray.ray.intersectBox(item.box,new THREE.Vector3());if(hit&&hit.distanceTo(camera.position)<distance){distance=hit.distanceTo(camera.position);nearest=item.b;}}if(nearest){const tip=$('#tooltip');tip.textContent=nearest.name;tip.style.left=Math.min(innerWidth-210,e.clientX+12)+'px';tip.style.top=(e.clientY+16)+'px';tip.hidden=false;}},100);});
renderer.domElement.addEventListener('pointerleave',()=>{clearTimeout(hoverTimer);$('#tooltip').hidden=true;});
controls.addEventListener('start',()=>{clearTimeout(hoverTimer);$('#tooltip').hidden=true;});

$('#loading').hidden=true;
requestAnimationFrame(frame);
}










