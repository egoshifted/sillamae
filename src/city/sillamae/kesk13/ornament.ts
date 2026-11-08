import * as THREE from 'three';
import {baseElevation, type SurveyPoint} from './design.ts';
import {wallCorners} from './cornice.ts';
import {courtyardWalls, hasGarland} from './street.ts';
import type {FacadeLevels} from './levels.ts';
import type {OpeningDetail} from './joinery.ts';

type Emit = (p: SurveyPoint) => void;
type Part = (id: string, name: string) => void;

export function detailBuilder(point: OpeningDetail['point'], emit: Emit) {
  function add(g: THREE.BufferGeometry) {
    const p = g.attributes.position, ix = g.index;
    for (let i = 0; i < (ix?.count ?? p.count); i++) {const j = ix ? ix.getX(i) : i; emit(point(p.getX(j), p.getY(j), p.getZ(j)));}
    g.dispose();
  }
  function box(l: number, r: number, b: number, t: number, front: number, back = .015) {
    const g = new THREE.BoxGeometry(r-l, t-b, back-front); g.translate((l+r)/2, (b+t)/2, (front+back)/2); add(g);
  }
  function line(points: number[][], radius = .012) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length*2), radius, 5, false));
  }
  function leaf(x: number, y: number, w: number, h: number, angle: number, depth: number) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    for (let i = 1; i <= 12; i++) {const u = i/12; s.lineTo(w*.5*Math.sin(Math.PI*u)*(i%2 ? .72 : 1), h*u);}
    for (let i = 11; i >= 0; i--) {const u = i/12; s.lineTo(-w*.5*Math.sin(Math.PI*u)*(i%2 ? .72 : 1), h*u);}
    const g = new THREE.ExtrudeGeometry(s, {depth: .025, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1, steps: 1});
    g.rotateZ(angle); g.translate(x,y,depth); add(g);
    line([[x,y,depth-.01],[x-Math.sin(angle)*h*.5,y+Math.cos(angle)*h*.5,depth-.016],[x-Math.sin(angle)*h*.88,y+Math.cos(angle)*h*.88,depth-.01]], .006);
  }
  return {add,box,line,leaf};
}

export function addBalconyOrnament(o: OpeningDetail, edge: number, trim: Emit, iron: Emit, part: Part, levels?: FacadeLevels) {
  if ((edge !== 0 && edge !== 7) || o.kind !== 'balcony') return;
  const {left:l,right:r,bottom:b,top:t} = o, c = (l+r)/2;
  const {box,line,leaf} = detailBuilder(o.point,trim);
  part(o.id+'/pilasters',o.label+' full-height rusticated pilasters');
  const foot = levels?.plinth ?? baseElevation+.43, head = t+.34, pitch = (head-foot)/19;
  for (const x of [c-1.48,c+1.48]) {
    for (let row = 0; row < 19; row++) box(x-.20,x+.20,foot+row*pitch+.012,foot+(row+1)*pitch-.012,-.075);
    box(x-.23,x+.23,head,head+.065,-.105);
  }
  part(o.id+'/capitals',o.label+' foliate pilaster capitals');
  for (const x of [c-1.48,c+1.48]) {
    box(x-.22,x+.22,head+.065,head+.43,-.10);
    for (let row = 0; row < 2; row++) for (let k = -2; k <= 2; k++) leaf(x+k*.085,head+.07+row*.16,.12,.22,-k*.13,-.15-row*.02);
    for (const sign of [-1,1]) line(Array.from({length:19},(_,i)=>{const u=i/18,a=u*Math.PI*2.1,rad=.075*(1-u*.70);return [x+sign*(.18+Math.cos(a)*rad),head+.35+Math.sin(a)*rad,-.19];}),.016);
    box(x-.29,x+.29,head+.43,head+.49,-.20);
    box(x-.26,x+.26,head+.39,head+.43,-.15);
  }
  part(o.id+'/carved-surround',o.label+' carved balcony opening surround');
  box(l-.14,r+.14,t+.10,t+.25,-.09);
  for (const x of [l-.105,r+.105]) box(x-.045,x+.045,t-.55,t+.10,-.09);
  for (let i=0;i<15;i++) leaf(l-.08+(r-l+.16)*i/14,t+.12,.105,.14,-Math.PI/2,-.115);
  for (const x of [l-.105,r+.105]) for(let i=0;i<6;i++) leaf(x,t-.52+i*.105,.09,.13,Math.PI,-.115);
  part(o.id+'/slab-moulding',o.label+' moulded balcony fascia and corbels');
  box(c-1.34,c+1.34,b-.10,b-.035,-.90,-.02);
  box(c-1.30,c+1.30,b-.20,b-.10,-.85,-.02);
  box(c-1.25,c+1.25,b-.25,b-.20,-.78,-.02);
  for (const x of [c-1.11,c+1.11]) {
    box(x-.10,x+.10,b-.48,b-.25,-.46);
    box(x-.12,x+.12,b-.32,b-.25,-.65);
    box(x-.08,x+.08,(levels?.lower[0] ?? 16)+.04,b-.48,-.09);
  }
  part(o.id+'/scrollwork',o.label+' balcony rail scrolls');
  const rail = detailBuilder(o.point,iron);
  for(const x of [c-1.10,c,c+1.10]) for(const side of [-1,1]) {
    rail.line([[x+side*.09,b+.16,-.79],[x+side*.09,b+.78,-.79]],.011);
    for(const y of [.29,.70]) rail.line(Array.from({length:25},(_,i)=>{const u=i/24,angle=-Math.PI/2+u*Math.PI*2.0,rad=.085*(1-u*.65);return [x+side*(.09+Math.cos(angle)*rad),b+y+Math.sin(angle)*rad,-.79];}),.011);
  }
}

// Proportions scaled from the Kesk-front bay 2 close-up (Street View May 2024, window height = 1.8 m):
// consoles about 0.7 m tall under the sill ends, a rosette between them, the swag and its two
// tassels hanging below, the tassels reaching about 1.3 m under the sill.
export function addGarland(o: OpeningDetail, emit: Emit, part: Part) {
  const {left:l,right:r,bottom:b} = o, c=(l+r)/2, {add,box,line,leaf}=detailBuilder(o.point,emit);
  part(o.id+'/sill-consoles',o.label+' carved sill consoles');
  for(const x of [l-.03,r+.03]) {
    box(x-.11,x+.11,b-.20,b-.115,-.15);
    box(x-.09,x+.09,b-.74,b-.20,-.10);
    box(x-.065,x+.065,b-.80,b-.74,-.08);
    for(let k=0;k<3;k++) leaf(x,b-.30-k*.15,.13,.16,Math.PI,-.115);
    const volute=new THREE.CylinderGeometry(.045,.045,.18,10);volute.rotateZ(Math.PI/2);volute.translate(x,b-.72,-.12);add(volute);
  }
  part(o.id+'/rosette',o.label+' rosette between the consoles');
  const disc=new THREE.CylinderGeometry(.075,.08,.035,16);disc.rotateX(Math.PI/2);disc.translate(c,b-.62,-.03);add(disc);
  for(let k=0;k<8;k++){const a=k*Math.PI/4;leaf(c+Math.sin(a)*.035,b-.62-Math.cos(a)*.035,.045,.05,a+Math.PI,-.05);}
  part(o.id+'/foliate-swag',o.label+' foliate swag and tassels');
  const x0=l+.2,x1=r-.2,top=b-.80,sag=.32,curve=(u:number)=>top-sag*Math.sin(Math.PI*u);
  line(Array.from({length:21},(_,i)=>{const u=i/20;return[x0+u*(x1-x0),curve(u),-.05];}),.035);
  for(let i=0;i<15;i++){const u=(i+.5)/15,slope=Math.atan(-sag*Math.PI/(x1-x0)*Math.cos(Math.PI*u));leaf(x0+u*(x1-x0),curve(u)-.03,.13,.15,-Math.PI/2+slope,-.085);}
  for(const x of [x0,x1]) {
    box(x-.04,x+.04,top-.03,top+.05,-.08);
    for(let k=0;k<3;k++) leaf(x,top-.08-k*.14,.12,.16,Math.PI,-.075);
  }
}

export function addWindowPanel(o: OpeningDetail, edge: number, emit: Emit, part: Part, transposed = false, complete = false) {
  if (o.kind !== 'window' || (!transposed && edge !== 0 && edge !== 7)) return;
  const {left:l,right:r,bottom:b} = o, c=(l+r)/2, {box,line,leaf}=detailBuilder(o.point,emit);
  const decorated = transposed || (complete ? hasGarland(edge,o.bay) : (edge===0&&o.bay===2)||(edge===7&&o.bay===9));
  if (o.upper && decorated && complete && !transposed) {addGarland(o,emit,part);return;}
  if (o.upper && decorated) {
    part(o.id+'/foliate-swag',o.label+' foliate swag and hanging drops');
    const y=b-.20,w=r-l-.12;
    line(Array.from({length:21},(_,i)=>{const u=i/20;return[c-w/2+u*w,y-.36*Math.sin(Math.PI*u),-.055];}),.028);
    for(let i=0;i<17;i++) {const u=(i+.5)/17;leaf(c-w/2+u*w,y-.36*Math.sin(Math.PI*u)-.035,.12,.15,-Math.PI/2+Math.atan(-.36*Math.PI/w*Math.cos(Math.PI*u)),-.09);}
    for(const x of [l+.06,r-.06]) {
      box(x-.065,x+.065,b-.25,b-.075,-.08);
      for(let k=0;k<3;k++) leaf(x,b-.33-k*.13,.13,.16,Math.PI,-.08);
    }
    line(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return[c+.07*Math.cos(a),b-.28+.035*Math.sin(a),-.06];}),.014);
    return;
  }
  if (!o.upper && (o.bay===4 || o.bay===7)) {
    part(o.id+'/sill-brackets',o.label+' sill support brackets');
    for(const x of [l+.05,r-.05]) {box(x-.07,x+.07,b-.30,b-.075,-.13);box(x-.09,x+.09,b-.24,b-.19,-.15);}
  }
  if (o.upper || !decorated) return;
  part(o.id+'/scalloped-panel',o.label+' scalloped under-sill panel');
  for(const x of [l+.03,r-.03]) {box(x-.08,x+.08,b-.37,b-.11,-.075);box(x-.09,x+.09,b-.40,b-.34,-.10);}
  for(let k=0;k<2;k++) {
    const points=[[l+.04,b-.40-k*.045,-.045],[l+.20,b-.40-k*.045,-.045]];
    for(let i=0;i<=20;i++) {const u=i/20;points.push([l+.20+(r-l-.40)*u,b-.40+.30*Math.sin(Math.PI*u)-k*.045,-.045]);}
    points.push([r-.04,b-.40-k*.045,-.045]);line(points,.014);
  }
}

export function addPlinth(body: Emit, brick: Emit, trim: Emit, part: Part, top = baseElevation+.43, bottom = baseElevation-.20) {
  const walls=wallCorners();
  const offset=(i:number,d:number): SurveyPoint=>{
    const c=walls[i],a=walls[(i+7)%8],b=walls[(i+1)%8],u=new THREE.Vector2(c[0]-a[0],c[1]-a[1]).normalize(),v=new THREE.Vector2(b[0]-c[0],b[1]-c[1]).normalize();
    const n=new THREE.Vector2(u.y,-u.x),m=new THREE.Vector2(v.y,-v.x),k=d/(1+n.dot(m));return [c[0]+(n.x+m.x)*k,c[1]+(n.y+m.y)*k,0];
  };
  for(let edge=0;edge<8;edge++) {
    const a=walls[edge],b=walls[(edge+1)%8],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const cuts=(courtyardWalls[edge]?.bays??[]).filter(b=>b.lower==='door').map(b=>[b.centre*length-.71,b.centre*length+.71]);
    const spans:number[][]=[];let start=0;for(const [lo,hi] of cuts){spans.push([start,lo]);start=hi;}spans.push([start,length]);
    for(const [label,lo,hi,projection,emit] of [['body',bottom,top-.15,.085,body],['brick-course',top-.15,top-.08,.10,brick],['coping',top-.08,top,.16,trim]] as const) {
      part(`plinth-${edge}/${label}`,`Edge ${edge} plinth ${label}`);
      const outerA=offset(edge,projection),outerB=offset((edge+1)%8,projection);
      for(const [s,t] of spans) {
        const p=(along:number,outer:boolean,h:number):SurveyPoint=>{const u=along/length,v=outer?outerA:a,w=outer?outerB:b;return [v[0]+(w[0]-v[0])*u,v[1]+(w[1]-v[1])*u,h];};
        const q=[p(s,false,lo),p(t,false,lo),p(t,true,lo),p(s,true,lo),p(s,false,hi),p(t,false,hi),p(t,true,hi),p(s,true,hi)];
        for(const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]) [q[i],q[j],q[k],q[i],q[k],q[l]].forEach(emit);
      }
    }
  }
}
