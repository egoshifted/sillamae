import * as THREE from 'three';
import type {OpeningDetail} from './joinery.ts';
import {eaves, type RoofShape, type SurveyPoint} from './design.ts';
import {detailBuilder, addWindowPanel} from './ornament.ts';
import {wallCorners} from './cornice.ts';

type Emit = (p: SurveyPoint) => void;
type Part = (id: string, name: string) => void;

export function addCourtyardDetail(o: OpeningDetail, edge: number, emit: Emit, iron: Emit, part: Part) {
  if (edge===0 || edge===7 || o.kind==='door') return;
  const {left:l,right:r,bottom:b,top:t}=o,c=(l+r)/2,{add,box}=detailBuilder(o.point,emit);
  if(o.kind==='window') {
    part(o.id+'/sill-consoles',o.label+' courtyard sill consoles');
    for(const x of [l+.07,r-.07]) {
      box(x-.075,x+.075,b-.31,b-.075,-.105);
      box(x-.095,x+.095,b-.13,b-.075,-.14);
      box(x-.065,x+.065,b-.34,b-.29,-.12);
    }
    if(o.upper && (edge===1||edge===6)) {
      part(o.id+'/end-head',o.label+' end-elevation stepped head');
      box(l-.15,r+.15,t+.11,t+.18,-.11);box(l-.20,r+.20,t+.18,t+.23,-.15);
      addWindowPanel(o,edge,emit,part,true);
    }
    return;
  }
  part(o.id+'/courtyard-head',o.label+' courtyard balcony head moulding');
  box(l-.13,r+.13,t+.11,t+.19,-.10);box(l-.19,r+.19,t+.19,t+.25,-.15);
  for(const x of [l-.09,r+.09])box(x-.035,x+.035,b,t+.11,-.06);
  part(o.id+'/courtyard-fascia',o.label+' courtyard balcony moulded fascia');
  box(c-1.09,c+1.09,b-.07,b-.025,-.69,.01);
  box(c-1.05,c+1.05,b-.20,b-.16,-.65,.01);
  part(o.id+'/courtyard-corbel',o.label+' courtyard balcony corbels');
  for(const x of [c-.79,c+.79]) {
    const shape=new THREE.Shape([[0,b-.16],[-.55,b-.16],[-.48,b-.28],[-.08,b-.67],[0,b-.67]].map(([d,h])=>new THREE.Vector2(d,h)));
    const g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(x+.09,0,0);add(g);
  }
  part(o.id+'/courtyard-scrolls',o.label+' courtyard rail scrolls');
  const rail=detailBuilder(o.point,iron);
  for(const x of [c-.85,c,c+.85]) for(const sign of [-1,1]) {
    rail.line([[x+sign*.075,b+.16,-.59],[x+sign*.075,b+.78,-.59]],.01);
    for(const y of [.29,.70])rail.line(Array.from({length:21},(_,i)=>{const u=i/20,a=-Math.PI/2+u*Math.PI*2,rad=.07*(1-u*.65);return[x+sign*(.075+Math.cos(a)*rad),b+y+Math.sin(a)*rad,-.59];}),.01);
  }
}

export function addCourtyardCornice(emit: Emit, part: Part, eavePoints: readonly SurveyPoint[] = eaves, edgeHeights?: RoofShape['edgeHeights'], breaks?: RoofShape['breaks']) {
  const walls=wallCorners(eavePoints), count=walls.length;
  const offset=(i:number,d:number):SurveyPoint=>{
    const c=walls[i],a=walls[(i+count-1)%count],b=walls[(i+1)%count],u=new THREE.Vector2(c[0]-a[0],c[1]-a[1]).normalize(),v=new THREE.Vector2(b[0]-c[0],b[1]-c[1]).normalize();
    const n=new THREE.Vector2(u.y,-u.x),m=new THREE.Vector2(v.y,-v.x),k=d/(1+n.dot(m));return[c[0]+(n.x+m.x)*k,c[1]+(n.y+m.y)*k,c[2]];
  };
  for(let edge=1;edge<count-1;edge++) {
    const pa=walls[edge],pb=walls[(edge+1)%count],heights=edgeHeights?.[edge];
    const a:SurveyPoint=[pa[0],pa[1],heights?.[0] ?? pa[2]],b:SurveyPoint=[pb[0],pb[1],heights?.[1] ?? pb[2]];
    part(`court-cornice-${edge}`,`Edge ${edge} courtyard cornice lower moulding`);
    for(const [lo,hi,projection] of [[-.30,-.23,.07],[-.23,-.18,.11]]) {
      const pc=offset(edge,projection),pd=offset((edge+1)%count,projection),c:SurveyPoint=[pc[0],pc[1],a[2]],d:SurveyPoint=[pd[0],pd[1],b[2]],p=(v:SurveyPoint,h:number):SurveyPoint=>[v[0],v[1],v[2]+h];
      const rearA=edgeHeights || breaks ? offset(edge,-.01) : a,rearB=edgeHeights || breaks ? offset((edge+1)%count,-.01) : b;
      const ra:SurveyPoint=[rearA[0],rearA[1],a[2]],rb:SurveyPoint=[rearB[0],rearB[1],b[2]];
      const sections:readonly (readonly [number,number])[]=[[0,a[2]],...(breaks?.[edge]??[]),[1,b[2]]];
      const mix=(a:SurveyPoint,b:SurveyPoint,t:number,h:number):SurveyPoint=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,h];
      for(let section=1;section<sections.length;section++) {
      const [u,hu]=sections[section-1],[v,hv]=sections[section],aa=mix(ra,rb,u,hu),bb=mix(ra,rb,v,hv),cc=mix(c,d,u,hu),dd=mix(c,d,v,hv);
      const q=[p(aa,lo),p(bb,lo),p(dd,lo),p(cc,lo),p(aa,hi),p(bb,hi),p(dd,hi),p(cc,hi)];
      for(const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]])[q[i],q[j],q[k],q[i],q[k],q[l]].forEach(emit);
      }
    }
  }
}
