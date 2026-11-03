import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {frontDesign, frontSchedule, sourcePoint} from './front-design.ts';
import {createFrontStudy} from './front.ts';
import type {OverrideContext} from '../../../engine/types.ts';

const context: OverrideContext = {
  scene: new THREE.Scene(),
  building: {id:'213730655',pick:304,name:'Ranna 31a',c:[1174.64,662.78],h:32.52,g:[]},
  terrain: {origin:[1140,620],step:100,width:2,height:2,values:[80,80,80,80],meta:{}},
  frame: {origin:[750,760],base:19.3},
  ground: [[1140,620,8,1230,620,8,1230,700,8],[1140,620,8,1230,700,8,1140,700,8]],
};

test('owner front photographs: nine rows, four outer columns, two balcony stacks and one offset entrance',()=>{
  const rows=frontSchedule();
  assert.equal(new Set(rows.map(o=>o.id)).size,78);
  assert.equal(rows.filter(o=>o.kind==='window').length,53);
  assert.equal(rows.filter(o=>o.kind==='balcony').length,18);
  assert.equal(rows.filter(o=>o.kind==='arch').length,2);
  assert.equal(rows.filter(o=>o.kind==='vent').length,4);
  for(let floor=0;floor<9;floor++) {
    assert.equal(rows.filter(o=>o.floor===floor&&o.group.startsWith('outer')).length,4);
    assert.equal(rows.filter(o=>o.floor===floor&&o.kind==='balcony').length,2);
  }
  const doors=rows.filter(o=>o.kind==='door'); assert.equal(doors.length,1);
  assert.ok(doors[0].x<0); assert.equal(doors[0].floor,0);
  assert.equal(rows.filter(o=>o.floor===0&&o.group==='centre'&&o.kind==='window').length,1);
});

test('real facade holes expose recessed infill and blind arches, rather than an intact wall behind a dark sticker',()=>{
  const model=createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    for(const [x,y,z,expected] of [[1.65,7.9,8.05,'plain-infill'],[-11.15,7.9,5.55,'plain-infill'],[-1.65,1.4,8.05,'plain-door'],[-1.65,28.6,8.05,'plain-shell']] as const) {
      const origin=new THREE.Vector3(x,y,z+3).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(0,0,-1).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction,0,10).intersectObject(model.root,true)[0];
      assert.ok(hit,`no infill for ${x},${y}`);
      assert.equal(((hit.object as THREE.Mesh).material as THREE.Material).name,expected);
      const local=model.root.worldToLocal(hit.point.clone()); assert.ok(local.z<z-.1,'front wall still covers opening');
    }
  } finally {model.dispose();}
});

test('survey decks and owner distant photos: 2.8 m floors leave the roof build-up above the top windows',()=>{
  const model=createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    const down=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld);
    const roof=(x:number,z:number)=>{const hit=new THREE.Raycaster(new THREE.Vector3(x,40,z).applyMatrix4(model.root.matrixWorld),down).intersectObject(model.root,true)[0];assert.ok(hit);return model.root.worldToLocal(hit.point.clone()).y;};
    assert.ok(Math.abs(roof(-10,2)-28.8)<.01&&Math.abs(roof(10,2)-28.8)<.01,'lower decks moved off the surveyed 28.8');
    assert.ok(Math.abs(roof(1.5,2)-30.2)<.01,'raised deck moved off the surveyed 30.2');
    const topHead=Math.max(...frontSchedule().filter(o=>o.kind==='window'&&o.floor!==null).map(o=>o.top));
    // With the former 3.05 m floors the top heads stood only 1 m below the surveyed deck.
    assert.ok(topHead<28.8-2.5,`top windows at ${topHead} leave no roof above them`);
  } finally {model.dispose();}
});

test('front study seats on entrance ground and keeps the high blades above the outer roof',()=>{
  const model=createFrontStudy(context);
  try {
    // Owner correction: the building stands a little above the entrance ground.
    assert.ok(Math.abs(model.root.userData.audit.datum-(8+frontDesign.lift))<1e-9);
    assert.ok(frontDesign.lift>0);
    assert.ok(model.root.userData.audit.bottom<0);
    model.root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model.root);
    assert.ok(bounds.max.y+19.3>39,'raised front silhouette lost');
    assert.ok(bounds.min.y+19.3<8,'foundation does not continue below land');
    assert.ok(sourcePoint(0,10)[1]>sourcePoint(0,0)[1]);
  } finally {model.dispose();}
});

test('owner roof close-up: central gable ridge stands above the flanking brick blades',()=>{
  const model=createFrontStudy(context);
  try {
    let centre=-Infinity, blades=-Infinity;
    model.root.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const p=o.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++) {
        const x=Math.abs(p.getX(i));
        if(x<.1)centre=Math.max(centre,p.getY(i));
        if(Math.abs(x-6.425)<.25||Math.abs(x-3.575)<.25)blades=Math.max(blades,p.getY(i));
      }
    });
    assert.ok(centre>blades+.3,'central crown is still lower than the brick blades');
  } finally {model.dispose();}
});

test('owner aerial: central roof is raised and stepped, with continuous parapet returns',()=>{
  const model=createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    function roofHeight(x:number,z:number) {
      const origin=new THREE.Vector3(x,40,z).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction).intersectObject(model.root,true)[0];
      assert.ok(hit,`missing roof at ${x},${z}`);
      return model.root.worldToLocal(hit.point.clone()).y;
    }
    const centre=roofHeight(1.5,2), left=roofHeight(-10,2), right=roofHeight(10,2);
    assert.ok(centre>left+1&&centre>right+1,'single flat deck still spans the roof');
    assert.ok(roofHeight(5,-4)<centre-1,'rear roof stem has not narrowed');
    assert.ok(roofHeight(5,2)>frontDesign.deck+1,'raised centre must widen behind the balcony recess');
    // Owner correction with aerial: the former sunken terrace behind each balcony stack is part of the raised roof.
    for(const x of [-5,-4.2,4.2,5])for(const z of [5.8,6.5,7.4])assert.ok(Math.abs(roofHeight(x,z)-centre)<.01,`sunken roof pocket behind the balcony at ${x},${z}`);
    for(const [x,z] of [[3.61,-4],[6.46,2],[-6.46,6.5]])assert.ok(roofHeight(x,z)>centre+.1,'parapet return missing');
    // Owner's higher aerial: no wall where the roof meets the balcony covers; the cover falls away from the deck edge.
    for(const x of [-5,5]) {
      let previous=Infinity;
      for(const z of [7.5,7.7,8,8.5,9]) {const h=roofHeight(x,z);assert.ok(h<=centre+.01,`wall between roof and balcony cover at ${x},${z}`);assert.ok(h<=previous+.01,'balcony cover does not fall from the roof');previous=h;}
    }
  } finally {model.dispose();}
});

test('owner side photographs: brick cheeks support the roof continuously from the foundation',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    // Below 1 m the wider aggregate block stands in front of the cheek's outer face.
    for(const side of [-1,1])for(const y of [1.2,12,27.9,31]) {
      const origin=new THREE.Vector3(side*7.5,y,9.1).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(-side,0,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction,0,4).intersectObject(model.root,true)[0];
      assert.ok(hit,'missing continuous brick cheek');
      assert.equal(((hit.object as THREE.Mesh).material as THREE.Material).name,'plain-shell');
      assert.ok(Math.abs(Math.abs(model.root.worldToLocal(hit.point.clone()).x)-6.65)<.005,'roof cheek moved off its supporting wall');
    }
  } finally {model.dispose();}
});

test('owner correction: inner roof cheeks stay high while outer cheeks slope down towards the roof',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    function top(x:number,z:number) {
      const origin=new THREE.Vector3(x,40,z).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction).intersectObject(model.root,true)[0];assert.ok(hit);
      return model.root.worldToLocal(hit.point.clone()).y;
    }
    for(const side of [-1,1]) {
      assert.ok(Math.abs(top(side*3.6,6)-top(side*3.6,9))<.01,'inner cheek still duplicates the outer slope');
      assert.ok(top(side*6.4,9)>top(side*6.4,6)+.5,'outer cheek lost its slope');
    }
  } finally {model.dispose();}
});

test('owner aerial: three roof blocks stand on the two lower roofs and raised central roof',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const fixtures=model.root.userData.audit.roof.fixtures;
    assert.equal(fixtures.length,3);assert.equal(fixtures.filter((f:{upper:boolean})=>f.upper).length,1);
    for(const [x,z,base] of [[-9.3,-2.6,29.3],[0,2.3,30.75],[9.3,-.6,29.3]]) {
      const origin=new THREE.Vector3(x-2,base+.05,z).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(1,0,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction,0,2).intersectObject(model.root,true)[0];
      assert.ok(hit,'roof block floats above its deck');
    }
  } finally {model.dispose();}
});

test('owner marked strip: inner balcony sides remain glazed below the short upper roof wall',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    for(const side of [-1,1])for(const y of [5,13.3,21.6]) {
      const origin=new THREE.Vector3(side*3,y,9.1).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(side,0,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction,0,2).intersectObject(model.root,true)[0];
      assert.ok(hit,'missing inner balcony glazing');
      assert.equal(((hit.object as THREE.Mesh).material as THREE.Material).name,'plain-infill','brick wall still covers the marked side glazing');
    }
    for(const side of [-1,1]) {
      const origin=new THREE.Vector3(side*3,26.5,9.1).applyMatrix4(model.root.matrixWorld);
      const direction=new THREE.Vector3(side,0,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction,0,2).intersectObject(model.root,true)[0];
      assert.ok(hit);assert.equal(((hit.object as THREE.Mesh).material as THREE.Material).name,'plain-shell','short upper wall was removed with the lower infill');
    }
  } finally {model.dispose();}
});

test('owner photograph: only the left balcony has a narrow masonry wall beside the ground-floor window',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const leftOrigin=new THREE.Vector3(-3.2,1.2,9.45).applyMatrix4(model.root.matrixWorld);
    const leftward=new THREE.Vector3(-1,0,0).transformDirection(model.root.matrixWorld);
    const left=new THREE.Raycaster(leftOrigin,leftward,0,2).intersectObject(model.root,true)[0];
    assert.ok(left,'missing left ground-floor masonry wall');
    assert.equal(((left.object as THREE.Mesh).material as THREE.Material).name,'plain-shell');
    const local=model.root.worldToLocal(left.point.clone());
    assert.ok(Math.abs(Math.abs(local.x)-3.64)<.03,'left masonry wall is still the wide pier');
    const frontOrigin=new THREE.Vector3(-3.72,1.2,12).applyMatrix4(model.root.matrixWorld);
    const forward=new THREE.Vector3(0,0,-1).transformDirection(model.root.matrixWorld);
    const frontHit=new THREE.Raycaster(frontOrigin,forward,0,6).intersectObject(model.root,true)[0];
    assert.ok(frontHit,'left masonry wall has no front corner');
    assert.ok(model.root.worldToLocal(frontHit.point.clone()).z>9.5,'front corner sits behind the balcony face');
    const aboveOrigin=new THREE.Vector3(-3.2,2.2,9.45).applyMatrix4(model.root.matrixWorld);
    const above=new THREE.Raycaster(aboveOrigin,leftward,0,2).intersectObject(model.root,true)[0];
    assert.ok(above,'missing masonry wall beside the first-floor window');
    assert.equal(((above.object as THREE.Mesh).material as THREE.Material).name,'plain-shell');
    const secondOrigin=new THREE.Vector3(-3.2,4,9.1).applyMatrix4(model.root.matrixWorld);
    const second=new THREE.Raycaster(secondOrigin,leftward,0,2).intersectObject(model.root,true)[0];
    assert.ok(second,'missing second-floor balcony side');
    assert.notEqual(((second.object as THREE.Mesh).material as THREE.Material).name,'plain-shell','masonry wall still runs into the second floor');
    const rightOrigin=new THREE.Vector3(3.2,2.2,9.1).applyMatrix4(model.root.matrixWorld);
    const rightward=new THREE.Vector3(1,0,0).transformDirection(model.root.matrixWorld);
    const right=new THREE.Raycaster(rightOrigin,rightward,0,2).intersectObject(model.root,true)[0];
    assert.ok(right,'missing right balcony side');
    assert.equal(((right.object as THREE.Mesh).material as THREE.Material).name,'plain-infill','right balcony still has the extra masonry wall');
    for(const side of [-1,1]) {
      const headOrigin=new THREE.Vector3(side*3.2,5.6,9.1).applyMatrix4(model.root.matrixWorld);
      const outward=new THREE.Vector3(side,0,0).transformDirection(model.root.matrixWorld);
      const head=new THREE.Raycaster(headOrigin,outward,0,2).intersectObject(model.root,true)[0];
      assert.ok(head,'missing side frame below the top floor');
      assert.equal(((head.object as THREE.Mesh).material as THREE.Material).name,'plain-frame','upper panel still covers the side frame');
    }
  } finally {model.dispose();}
});

test('owner close photo: the recessed plinth runs from the outer support to the side pier without slots',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const backward=new THREE.Vector3(0,0,-1).transformDirection(model.root.matrixWorld);
    // The former plinth stopped .14 m short of both supports, opening slots into the void under the balcony; the outer block now fronts the left end.
    for(const x of [-5.9,-5,-3.9,-3.83])for(const y of [.5-frontDesign.lift,.85-frontDesign.lift]) {
      const origin=new THREE.Vector3(x,y,12).applyMatrix4(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,backward,0,6).intersectObject(model.root,true)[0];
      assert.ok(hit,'nothing closes the plinth');
      const z=model.root.worldToLocal(hit.point.clone()).z;
      assert.ok(Math.abs(z-(frontDesign.balconyFront-.3))<.02,`plinth face at x ${x} is ${z.toFixed(2)}, not .30 m behind the balcony face`);
    }
  } finally {model.dispose();}
});

test('owner wide photo: outer brick walls stand proud on aggregate blocks and the entrance wall has a capped base',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const backward=new THREE.Vector3(0,0,-1).transformDirection(model.root.matrixWorld);
    const depth=(x:number,y:number)=>{
      const hit=new THREE.Raycaster(new THREE.Vector3(x,y,12).applyMatrix4(model.root.matrixWorld),backward,0,8).intersectObject(model.root,true)[0];
      assert.ok(hit,`nothing at x ${x}, height ${y}`);return model.root.worldToLocal(hit.point.clone()).z;
    };
    const face=frontDesign.balconyFront;
    for(const x of [-6.4,6.4])for(const y of [2,10,20]) assert.ok(Math.abs(depth(x,y)-(face+frontDesign.outerCheekProjection))<.01,`outer wall at x ${x}, height ${y} is flush with the balcony`);
    for(const x of [-6.4,-6.05,6.05,6.4]) assert.ok(depth(x,.6-frontDesign.lift)>face+frontDesign.outerCheekProjection+.05,`no aggregate block in front of the outer wall at x ${x}`);
    for(const x of [-3.2,-.5,2.5]) {
      assert.ok(Math.abs(depth(x,.6-frontDesign.lift)-(frontDesign.centreFront+.02))<.005,`entrance wall base missing at x ${x}`);
      assert.ok(Math.abs(depth(x,1.02-frontDesign.lift)-(frontDesign.centreFront+.05))<.005,`entrance wall base cap missing at x ${x}`);
    }
    const downward=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld);
    // Without a recess floor these rays fell to the foundation top just above the datum.
    for(const x of [-6,-5,-4,4,5,6]) {
      const floor=new THREE.Raycaster(new THREE.Vector3(x,.8-frontDesign.lift,face-.15).applyMatrix4(model.root.matrixWorld),downward,0,3).intersectObject(model.root,true)[0];
      assert.ok(floor&&Math.abs(model.root.worldToLocal(floor.point.clone()).y-(frontDesign.entranceLevel-frontDesign.lift))<.005,`hole under the balcony cap at x ${x}`);
    }
    const rightward=new THREE.Vector3(1,0,0).transformDirection(model.root.matrixWorld);
    const inner=new THREE.Raycaster(new THREE.Vector3(3,.6-frontDesign.lift,8.6).applyMatrix4(model.root.matrixWorld),rightward,0,3).intersectObject(model.root,true)[0];
    assert.ok(inner&&Math.abs(model.root.worldToLocal(inner.point.clone()).x-3.8)<.01,'right balcony plinth is open at its inner end');
  } finally {model.dispose();}
});

test('owner close front photo: diamond grilles over the two left ground-floor windows only',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const backward=new THREE.Vector3(0,0,-1).transformDirection(model.root.matrixWorld);
    const lattice=(x:number)=>{
      let hits=0;
      for(let dx=-.7;dx<=.7;dx+=.02) for(const y of [2,2.3,2.6]) {
        const hit=new THREE.Raycaster(new THREE.Vector3(x+dx,y,frontDesign.sideFront+3).applyMatrix4(model.root.matrixWorld),backward,0,4).intersectObject(model.root,true)[0];
        if(hit&&model.root.worldToLocal(hit.point.clone()).z>frontDesign.sideFront+.01)hits++;
      }
      return hits;
    };
    // Bars in both diagonal directions cover part of each sweep, never all of it.
    for(const x of [-11.15,-8.35]) {const n=lattice(x);assert.ok(n>20&&n<200,`no diamond grille over the window at ${x}: ${n} hits`);}
    for(const x of [8.35,11.15]) assert.equal(lattice(x),0,`unexpected grille over the window at ${x}`);
  } finally {model.dispose();}
});

test('owner wing photos: basement stairs run down along both outer wings between walls to a landing and door',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const b=frontDesign.basementStairs, s={...b,floor:b.floor-frontDesign.lift,top:b.top-frontDesign.lift}, centre=frontDesign.sideFront+s.inner+s.width/2;
    const down=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld), back=new THREE.Vector3(0,0,-1).transformDirection(model.root.matrixWorld);
    // These probes measure stair construction beneath the wall-mounted service pipe.
    const ray=(from:[number,number,number],dir:THREE.Vector3)=>{const hit=new THREE.Raycaster(new THREE.Vector3(...from).applyMatrix4(model.root.matrixWorld),dir,0,10).intersectObject(model.root,true).find(h=>((h.object as THREE.Mesh).material as THREE.Material).name!=='gas-pipe-yellow');return hit&&{p:model.root.worldToLocal(hit.point.clone()),m:((hit.object as THREE.Mesh).material as THREE.Material).name};};
    for(const run of s.runs) {
      const dir=Math.sign(run.low-run.high), runEnd=run.low-dir*s.landing;
      // Before this the apron covered the strip at entrance level and nothing went below it.
      let previous=Infinity;
      for(let f=.05;f<1;f+=.15){const hit=ray([run.high+(runEnd-run.high)*f,3,centre],down);assert.ok(hit&&hit.p.y<previous-.05,`stair does not descend at ${f.toFixed(2)}`);previous=hit.p.y;}
      const landing=ray([(runEnd+run.low)/2,3,centre],down);
      assert.ok(landing&&Math.abs(landing.p.y-s.floor)<.01,'no landing at the basement floor');
      // Owner frontal photo: the door faces down the stair from the balcony cheek's side, not from the wing front.
      const along=new THREE.Vector3(dir,0,0).transformDirection(model.root.matrixWorld);
      const door=ray([(runEnd+run.low)/2,s.floor+1,centre],along);
      assert.ok(door&&door.m==='plain-door'&&Math.abs(Math.abs(door.p.x)-6.65)<.25,'no basement door in the cheek at the foot of the stair');
      const wing=ray([(runEnd+run.low)/2,s.floor+1,centre],back);
      assert.ok(wing&&wing.m!=='plain-door','the basement door is still in the wing front');
      // Both run down towards their balcony, starting just past the tower corner.
      assert.ok(Math.abs(run.low)<Math.abs(run.high)&&Math.abs(run.high)>frontDesign.halfWidth,'stair does not start past the tower corner');
      // Owner corrections: a gap runs between the facade and the inner wall all along the stair, left open rather than paved.
      for(const f of [.2,.5,.8]){const gap=ray([run.high+(runEnd-run.high)*f,3,frontDesign.sideFront+s.gap/2],down);assert.ok(!gap||gap.p.y<frontDesign.entranceLevel-frontDesign.lift-.1,'the gap between the facade and the inner wall is paved or walled');}
      // Owner correction: the high end is the open way in, so a ray along the channel from beyond it meets the first step, not an end wall.
      const entry=ray([run.high-dir*1.5,s.top-.1,centre],along);
      assert.ok(entry&&dir*(entry.p.x-run.high)>-.01,'the stair entrance is closed off');
      const wallTop=(x:number)=>ray([x,3,frontDesign.sideFront+s.inner+s.width+s.wall/2],down)!.p.y;
      assert.ok(wallTop(run.high+dir*.3)>wallTop(run.low-dir*.3)+.3,'outer wall top does not fall with the stair');
    }
  } finally {model.dispose();}
});

test('owner entrance photo: two low rises, a flared approach and a landing level with the door',()=>{
  const model=createFrontStudy(context);model.root.updateMatrixWorld(true);
  try {
    const entry=model.root.userData.audit.entrance,door=frontSchedule().find(o=>o.kind==='door')!;
    assert.equal(entry.landingTop,door.bottom);
    assert.ok(entry.streetLevel<entry.treadTop&&entry.treadTop<entry.landingTop);
    assert.ok(entry.entryBase<entry.streetLevel);
    const backWidth=entry.tread[1][0]-entry.tread[0][0],frontWidth=entry.tread[2][0]-entry.tread[3][0];assert.ok(frontWidth>backWidth+.8,'approach no longer flares towards the street');
    const heights=[1.8,3].map(out=>{
      const origin=new THREE.Vector3(-1.65,5,8.05+out).applyMatrix4(model.root.matrixWorld),direction=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld);
      const hit=new THREE.Raycaster(origin,direction).intersectObject(model.root,true)[0];assert.ok(hit);return model.root.worldToLocal(hit.point.clone()).y;
    });
    assert.ok(Math.abs(heights[0]-entry.landingTop)<1e-5);assert.ok(Math.abs(heights[1]-entry.treadTop)<1e-5);
    const thresholdOrigin=new THREE.Vector3(-1.65,.5,7.95).applyMatrix4(model.root.matrixWorld),down=new THREE.Vector3(0,-1,0).transformDirection(model.root.matrixWorld);
    const threshold=new THREE.Raycaster(thresholdOrigin,down).intersectObject(model.root,true)[0];assert.ok(threshold,'landing stops short of the recessed door');
    assert.ok(Math.abs(model.root.worldToLocal(threshold.point.clone()).y-door.bottom)<1e-5);
  } finally {model.dispose();}
});
