import {splitPolygon} from '../../../engine/survey/carve.ts';
import * as THREE from 'three';
import {detailBuilder} from './ornament.ts';
import {wallCorners} from './cornice.ts';
import {eaveHeight, baseElevation, ridges, type RoofShape, type SurveyPoint} from './design.ts';
import {roofHeight, roofVents} from './roof.ts';
import {chimneyRows} from './chimneys.ts';
import type {OpeningDetail} from './joinery.ts';
type Emit=(p:SurveyPoint)=>void;
type Part=(id:string,name:string)=>void;

export function finishOpening(o:OpeningDetail,edge:number,trim:Emit,metal:Emit,door:Emit,part:Part) {
 const {left:l,right:r,bottom:b,top:t}=o,c=(l+r)/2;
 if(o.kind==='door') {
  const wood=detailBuilder(o.point,door),hardware=detailBuilder(o.point,metal),stone=detailBuilder(o.point,trim);
  part(o.id+'/door-leaves',o.label+' paired recessed door leaves');
  for(const [a,z] of [[l+.09,c-.015],[c+.015,r-.09]]) {
   wood.box(a,z,b+.035,t-.09,.135,.17);
   for(const [lo,hi] of [[b+.16,b+.83],[b+.96,t-.22]]) {
    wood.box(a+.07,z-.07,lo,hi,.11,.135);
    for(const x of [a+.04,z-.04])wood.box(x-.015,x+.015,lo-.025,hi+.025,.095,.14);
   }
  }
  part(o.id+'/hardware',o.label+' handle hinges and lock');
  hardware.box(c+.07,c+.105,b+.88,b+1.1,.075,.14);
  hardware.line([[c+.088,b+.93,.073],[c+.22,b+.93,.073]],.012);
  for(const x of [l+.08,r-.08])for(const h of [b+.35,t-.35])hardware.box(x-.015,x+.015,h-.045,h+.045,.08,.15);
  part(o.id+'/threshold',o.label+' stone threshold');
  stone.box(l-.06,r+.06,Math.min(baseElevation-.30,b-.08),b,-.23,.19);
 }
 if(o.kind==='balcony'&&(edge===0||edge===7)) {
  const d=detailBuilder(o.point,trim);
  part(o.id+'/capital-rosettes',o.label+' capital flowers and carved corner rosettes');
  for(const x of [c-1.48,c+1.48])for(const shift of [-.11,.11]) {
   for(let k=0;k<6;k++){const a=k*Math.PI/3;d.leaf(x+shift+Math.sin(a)*.025,t+.64+Math.cos(a)*.025,.065,.10,a,-.035);}
  }
  for(const x of [l-.105,r+.105]) {
   d.line(Array.from({length:25},(_,i)=>[x+.052*Math.cos(i*Math.PI/12),t+.18+.052*Math.sin(i*Math.PI/12),-.145]),.012);
  }
  part(o.id+'/fluted-supports',o.label+' fluted balcony supports');
  for(const x of [c-1.11,c+1.11])for(const dx of [-.042,0,.042])d.line([[x+dx,16.94,-.115],[x+dx,b-.48,-.115]],.009);
 }
}

export function finishRoof(shape:RoofShape,roof:Emit,metal:Emit,dark:Emit,part:Part, outerEaves:readonly SurveyPoint[]=shape.eaves) {
 const emitBox=(point:OpeningDetail['point'],out:Emit)=>detailBuilder(point,out);
 for(let edge=0;edge<shape.eaves.length;edge++) {
  const a=outerEaves[edge],b=outerEaves[(edge+1)%shape.eaves.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  const heights=shape.edgeHeights?.[edge]??[a[2],b[2]];
  const p=(u:number,s:number,lift:number):SurveyPoint=>[a[0]+ux*u-uz*s,a[1]+uz*u+ux*s,eaveHeight(shape,edge,u/len)+lift];
  part('roof-edge-'+edge,'Edge '+edge+' corrugated sheet lip');
  const n=Math.ceil(len/.177)*8;
  for(let i=0;i<n;i++) {
   const u=len*i/n,v=len*(i+1)/n,ha=.025+.012*Math.cos(2*Math.PI*u/.177),hb=.025+.012*Math.cos(2*Math.PI*v/.177);
   const q=[p(u,-.035,ha),p(v,-.035,hb),p(v,.065,hb),p(u,.065,ha)];
   [q[0],q[2],q[1],q[0],q[3],q[2],p(u,-.035,ha-.007),q[1],q[0],p(u,-.035,ha-.007),p(v,-.035,hb-.007),q[1]].forEach(roof);
  }
 }
 const anchors=[...shape.eaves,...ridges,...(shape.extra??[])];
 for(const [k,[i,j]] of [[8,9],[8,10],[0,8],[1,9],[2,9],[6,10],[7,10]].entries()) {
  const a=anchors[i],b=anchors[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;
  part('roof-cap-'+k,'Ridge and hip covering '+(k+1));
  const p=(u:number,side:number):SurveyPoint=>{const t=.025+u*.95,x=a[0]+(b[0]-a[0])*t+nx*side,z=a[1]+(b[1]-a[1])*t+nz*side;return[x,z,roofHeight(x,z,shape)+.025+.025*Math.cos(side/.14*Math.PI/2)];};
  for(const side of [-1,1]){const q=[p(0,0),p(1,0),p(1,side*.14),p(0,side*.14)];(side>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]).forEach(i=>roof(q[i]));}
 }
 for(const [i,d] of roofVents.entries()) {
  const a=shape.eaves[d.edge],b=shape.eaves[(d.edge+1)%8],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  const cx=a[0]+(b[0]-a[0])*d.t-uz*d.setback,cz=a[1]+(b[1]-a[1])*d.t+ux*d.setback,h=roofHeight(cx,cz,shape);
  const p=(u:number,y:number,s=0):SurveyPoint=>[cx+ux*u-uz*s,cz+uz*u+ux*s,h+y];
  const g=emitBox(p,dark);part('vent-'+i+'/grille','Roof vent '+(i+1)+' recessed grille');
  const radius=d.width/2-.1;
  for(let x=-radius+.07;x<radius;x+=.14){const top=d.arched?.15+Math.sqrt(Math.max(0,radius*radius-x*x)):.46;g.box(x-.012,x+.012,.10,top,.035,.065);}
  g.box(-radius,radius,.19,.215,.03,.065);
 }
 for(const row of chimneyRows) {
  const a=shape.eaves[row.edge],b=shape.eaves[(row.edge+1)%8],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  for(const [group,t] of row.fractions.entries())for(const [stack,s] of [1.7,3.25,4.8].entries()) {
   const cx=a[0]+(b[0]-a[0])*t-uz*s,cz=a[1]+(b[1]-a[1])*t+ux*s;
   const p=(u:number,y:number,v=0):SurveyPoint=>[cx+ux*u-uz*v,cz+uz*u+ux*v,y];
   const w=stack===2?.28:.34,depth=stack===2?.34:.4;
   const top=Math.max(...[[-w,-depth],[w,-depth],[w,depth],[-w,depth]].map(([u,v])=>{const q=p(u,0,v);return roofHeight(q[0],q[1],shape)+.035;}))+(stack===2?.77:.92);
   if(stack===1)continue;
   part('chimney-'+row.edge+'-'+group+'-'+stack+'/cladding','Chimney vertical sheet seams');const g=emitBox(p,metal);
   for(const side of [-1,1])for(let x=-w+.06;x<w-.02;x+=.14){const q=p(x,0,side*(depth+.005)),bottom=roofHeight(q[0],q[1],shape)+.18;g.box(x-.008,x+.008,bottom,top,side*.405-.008,side*.405+.008);}
  }
 }
}

export function addressPlaques(trim:Emit,ink:Emit,part:Part) {
 const walls=wallCorners(),a=walls[7],b=walls[0],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
 const p=(u:number,h:number,d=0):SurveyPoint=>[a[0]+ux*u-uz*d,a[1]+uz*u+ux*d,h];
 const c=len-1.48,plate=detailBuilder(p,trim),text=detailBuilder(p,ink);
 part('address/flagpole-fitting','Wall-mounted flagpole socket beside address');
 text.box(c+.46,c+.53,18.47,18.78,-.04,.01);
 text.line([[c+.495,18.52,-.045],[c+.495,18.89,-.25]],.022);
 text.line([[c+.495,18.60,-.04],[c+.495,18.73,-.16]],.012);
 part('address/plates','Kesk 13 number and street plaques');plate.box(c-.24,c+.24,18.55,18.86,-.012,-.003);plate.box(c-.38,c+.38,18.13,18.42,-.012,-.003);

}

export function sheetLaps(points: readonly number[],centre:readonly number[],emit:Emit,part:Part) {
 part('roof-sheet-laps','Corrugated sheet horizontal end laps');
 for(let i=0;i<points.length;i+=9) {
  const triangle=Array.from({length:3},(_,k)=>[points[i+k*3]+centre[0],points[i+k*3+2]+centre[1],points[i+k*3+1]+baseElevation]);
  const lo=Math.min(...triangle.map(p=>p[2])),hi=Math.max(...triangle.map(p=>p[2]));
  for(let h=Math.ceil(lo/.85)*.85;h<hi;h+=.85) {
   const [above]=splitPolygon(triangle,p=>p[2]-h),[,band]=splitPolygon(above,p=>p[2]-h-.018);
   for(let j=1;j<band.length-1;j++)for(const p of [band[0],band[j],band[j+1]])emit([p[0],p[1],p[2]+.008]);
  }
 }
}
