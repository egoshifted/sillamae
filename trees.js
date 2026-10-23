import * as THREE from 'three';

// Reusable branching silhouettes with small faceted leaf masses, rather than smooth balls.
function canopyGeometry(conifer,detail,variant){
  let seed=1009+variant*137+detail*71,rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colours=[],normals=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3(),v=new THREE.Vector3(),colour=new THREE.Color();
  function add(geo,x,y,z,sx,sy,sz,shade){
    p.set(x,y,z);s.set(sx,sy,sz);q.setFromEuler(new THREE.Euler(rand()*.15,rand()*6.28,rand()*.12));matrix.compose(p,q,s);
    const a=geo.attributes.position;colour.setHSL(conifer?.28:.245,conifer?.32:.46,shade);
    for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);colours.push(colour.r,colour.g,colour.b);const n=conifer?new THREE.Vector3().fromBufferAttribute(geo.attributes.normal,i):new THREE.Vector3().fromBufferAttribute(a,i).normalize();n.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));normals.push(n.x,n.y,n.z);}
  }
  if(conifer){
    const geo=new THREE.ConeGeometry(1,1,detail===2?9:6,1).toNonIndexed();
    const tiers=detail===0?3:detail===1?5:8;
    for(let j=0;j<tiers;j++){let t=j/(tiers-1);add(geo,0,.34+t*.54,0,.85*(1-t)+.12,.32,.85*(1-t)+.12,.12+t*.1);}
    geo.dispose();
  }else{
    const geo=new THREE.IcosahedronGeometry(1,0),count=detail===2?32:detail===1?14:3;
    for(let j=0;j<count;j++){
      const a=j*2.39996+variant,yy=rand()*2-1,r=Math.sqrt(1-yy*yy),rr=detail===2?.85:.65;
      let x=Math.cos(a)*r*rr,z=Math.sin(a)*r*rr,y=.68+yy*.26;
      const size=detail===2?.22+rand()*.16:detail===1?.32+rand()*.15:.72;
      add(geo,x,y,z,size,size*.37,size,.19+rand()*.11+(yy+1)*.018);
    }
    geo.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingSphere();return g;
}
export function addTrees(scene,trees,origin,base){
  const leaf=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:false}),bark=new THREE.MeshStandardMaterial({color:'#665344',roughness:1});
  // Small leaf markings break up the solid canopy surfaces without individual leaf meshes.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const paint=canvas.getContext('2d');
  paint.fillStyle='#9b9b9b';paint.fillRect(0,0,128,128);let seed=917;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<460;i++){let n=155+Math.floor(random()*100);paint.fillStyle=`rgb(${n},${n},${n})`;paint.beginPath();paint.ellipse(random()*128,random()*128,2+random()*3,1+random()*2,random()*6.28,0,Math.PI*2);paint.fill();}
  const leafTexture=new THREE.CanvasTexture(canvas);leafTexture.wrapS=leafTexture.wrapT=THREE.RepeatWrapping;leafTexture.colorSpace=THREE.SRGBColorSpace;
  leaf.onBeforeCompile=shader=>{shader.uniforms.leafMap={value:leafTexture};shader.vertexShader='varying vec3 leafPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nleafPosition=position;');shader.fragmentShader='uniform sampler2D leafMap;varying vec3 leafPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= .65 + .35 * texture2D(leafMap,leafPosition.xz*2.0+leafPosition.yy*3.0).rgb;');};
  const geometries=Array.from({length:2},(_,con)=>Array.from({length:3},(_,level)=>canopyGeometry(!!con,level,con+level)));
  const cells=new Map(),dummy=new THREE.Object3D(),colour=new THREE.Color(),up=new THREE.Vector3(0,1,0),dir=new THREE.Vector3();
  for(const t of trees){if(t.h<3)continue;let key=Math.floor(t.p[0]/90)+','+Math.floor(t.p[1]/90);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);}
  const chunks=[];
  for(const list of cells.values()){
    const group=new THREE.Group(),levels=[new THREE.Group(),new THREE.Group(),new THREE.Group()];levels.forEach(l=>group.add(l));
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,1,1,5),bark,list.length*4);let ti=0;
    for(const t of list){let x=t.p[0]-origin[0],z=t.p[1]-origin[1],y=t.z-base,h=Math.min(25,t.h),r=Math.min(6,Math.max(1,t.r));
      dummy.rotation.set(0,0,0);dummy.position.set(x,y+h*.3,z);dummy.scale.set(.11+r*.025,h*.6,.11+r*.025);dummy.updateMatrix();trunks.setMatrixAt(ti++,dummy.matrix);
      for(let j=0;j<3;j++){let a=j*2.094+t.p[0],start=new THREE.Vector3(x,y+h*.32,z),end=new THREE.Vector3(x+Math.cos(a)*r*.65,y+h*.63,z+Math.sin(a)*r*.65);dir.subVectors(end,start);dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,dir.clone().normalize());dummy.scale.set(.075,dir.length(),.075);dummy.updateMatrix();trunks.setMatrixAt(ti++,dummy.matrix);}
    }
    trunks.computeBoundingSphere();trunks.castShadow=true;group.add(trunks);
    for(let con=0;con<2;con++){
      const subset=list.filter(t=>(t.type==='Okaspuu'?1:0)===con);if(!subset.length)continue;
      for(let level=0;level<3;level++){
        const mesh=new THREE.InstancedMesh(geometries[con][level],leaf,subset.length);
        for(let i=0;i<subset.length;i++){const t=subset[i],r=Math.min(6,Math.max(1,t.r)),h=Math.min(25,t.h);dummy.rotation.set(0,t.p[0]*.3,0);dummy.position.set(t.p[0]-origin[0],t.z-base,t.p[1]-origin[1]);dummy.scale.set(r,h,r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);colour.setHSL(.08, .06, .76+(i%5)*.035);mesh.setColorAt(i,colour);}
        mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=false;levels[level].add(mesh);
      }
    }
    const centre=new THREE.Vector3(list[0].p[0]-origin[0],0,list[0].p[1]-origin[1]);scene.add(group);chunks.push({group,levels,centre,trunks,level:-1});
  }
  const distant=new THREE.Group(),farCells=new Map();scene.add(distant);
  for(const t of trees){if(t.h<3)continue;const con=t.type==='Okaspuu'?1:0,key=Math.floor(t.p[0]/360)+','+Math.floor(t.p[1]/360)+','+con;if(!farCells.has(key))farCells.set(key,{con,list:[]});farCells.get(key).list.push(t);}
  for(const {con,list} of farCells.values()){const mesh=new THREE.InstancedMesh(geometries[con][0],leaf,list.length);for(let i=0;i<list.length;i++){const t=list[i],r=Math.min(6,Math.max(1,t.r));dummy.rotation.set(0,t.p[0]*.3,0);dummy.position.set(t.p[0]-origin[0],t.z-base,t.p[1]-origin[1]);dummy.scale.set(r,Math.min(25,t.h),r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.computeBoundingSphere();distant.add(mesh);}
  let farMode=false;return {update(target,ppm){let changed=false;const far=ppm<=1.3;distant.visible=far;for(const chunk of chunks)chunk.group.visible=!far;if(far!==farMode){changed=true;farMode=far;}if(far)return changed;for(const chunk of chunks){const distance=Math.hypot(chunk.centre.x-target.x,chunk.centre.z-target.z),level=ppm>5&&distance<140?2:ppm>1.3&&distance<350?1:0;if(level!==chunk.level){chunk.level=level;chunk.levels.forEach((g,i)=>g.visible=i===level);chunk.trunks.visible=ppm>.8;changed=true;}}return changed;}};
}



