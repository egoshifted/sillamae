import * as THREE from 'three';
import lettering from './lettering.ts';
import {front,garden,plinthTop} from './facade.ts';
import {bayBase} from './shell.ts';
import type {Face, ModelOptions} from './types.ts';
import type {detailBuilder} from './detail-tools.ts';

export function addRodinaOrnaments(b: ReturnType<typeof detailBuilder>,{compact=false}: ModelOptions={}){
 const {box,shape,line,ring,disk,leaf}=b,inventory: Record<string,unknown>[]=[];
 function swag(face: Face,a: number,y: number,w: number,h: number,d=.23,id='swag'){
  for(let k=0;k<3;k++){const pts=Array.from({length:11},(_,i)=>{const t=i/10;return[a-w/2+w*t,y-h*Math.sin(Math.PI*t)-k*.035,d+.02*k];});line(id+'-drape-'+k,pts,.022,'trim',face,20,6);}
  for(const s of [-1,1]){disk(id+'-pin',a+s*w/2,y,.055,.045,d,'trim',face);leaf(id+'-fold',a+s*w/2,y-.26,.16,.28,d,s*.27,'trim',face,2);}
 }
 function roundel(face: Face,a: number,y: number,r=.31,id='roundel'){
  disk(id+'-plate',a,y,r,.08,-.02,'trim',face);ring(id+'-outer',a,y,r,r,.07,.022,'trim',face);ring(id+'-inner',a,y,r*.66,r*.66,.075,.014,'trim',face);
  for(let i=0;i<8;i++){const t=i*Math.PI/4;leaf(id+'-rosette-'+i,a+Math.cos(t)*r*.15,y+Math.sin(t)*r*.15,r*.43,r*.53,.06,t-Math.PI/2,'trim',face,2);}
  disk(id+'-heart',a,y,r*.12,.1,.02,'trim',face);
  if(!compact)for(const sx of [-1,1])for(const sy of [-1,1])leaf(id+'-corner',a+sx*r*.84,y+sy*r*.84,r*.28,r*.4,.0,Math.atan2(sy,sx)-Math.PI/2,'trim',face,2);
  inventory.push({id,face,centre:[a,y],type:'roundel'});
 }
 function capital(face: Face,a: number,width: number){
  const half=width/2,k=(half+.09)/.57;
  box(face+'-capital-neck',a-half-.02,a+half+.02,7.82,7.98,-.02,.17,'trim',face);
  shape(face+'-capital-basket',[[a-half,7.94],[a+half,7.94],[a+half+.05,8.43],[a-half-.05,8.43]],.19,-.02,'trim',face);
  box(face+'-capital-abacus',a-half-.09,a+half+.09,8.43,8.52,-.02,.21,'trim',face);
  box(face+'-capital-abacus-step',a-half-.05,a+half+.05,8.36,8.43,-.02,.19,'trim',face);
  function acanthus(x: number,y: number,w: number,h: number,d: number,angle: number){
   leaf(face+'-capital-acanthus',a+x,y,w,h,d,angle,'trim',face,4);
   if(!compact)for(const side of [-1,1])for(let j=1;j<=3;j++){const t=j/5,xx=a+x,yy=y+t*h;line(face+'-capital-leaf-vein',[[xx,yy,d+.06],[xx+side*w*.22,yy+h*.12,d+.07],[xx+side*w*.38,yy+h*.15,d+.04]],.006,'trim',face,6,4);}
   ring(face+'-capital-leaf-curl',a+x-Math.sin(angle)*h*.82,y+Math.cos(angle)*h*.82,w*.17,h*.09,d+.06,.012,'trim',face,0,Math.PI*1.35);
  }
  for(let i=-3;i<=3;i++)acanthus(i*.122*k,7.94,.19*k,.27,.13,-i*.07);
  for(let i=-2;i<=2;i++)acanthus(i*.18*k,8.09,.21*k,.29,.14,-i*.1);
  for(const x of [-.24,0,.24])acanthus(x*k,8.26,.19*k,.17,.15,-x*.5);
  for(const s of [-1,1]){const pts=Array.from({length:19},(_,i)=>{const t=i/18*Math.PI*2.1,r=.12*(1-i/23);return[a+s*(.38*k+Math.cos(t)*r),8.31+Math.sin(t)*r,.19];});line(face+'-capital-volute',pts,.035,'trim',face,28,7);}
  for(let i=0;i<6;i++){const t=i*Math.PI/3;leaf(face+'-capital-flower-petal',a,8.35,.045,.08,.15,t,'trim',face,1);}disk(face+'-capital-flower',a,8.35,.022,.055,.17,'trim',face);inventory.push({id:face+'-capital-'+a,face,type:'Corinthian capital',centre:[a,8.2]});
 }
 function cornerPanel(face: Face,a: number,width: number){
  const half=width/2;
  box(face+'-corner-pier',a-half,a+half,plinthTop,7.95,-.025,.14,'trim',face);
  box(face+'-corner-relief-bed',a-half,a+half,7.95,8.50,-.02,.15,'trim',face);
  box(face+'-corner-abacus',a-half-.055,a+half+.055,8.50,8.56,-.02,.19,'trim',face);
  if(width<1.5)swag(face,a,8.39,width*.83,.23,.17,face+'-corner-garland');
  else{
   ring(face+'-corner-wreath',a,8.22,.26,.26,.17,.03,'trim',face);
   if(!compact)for(let i=0;i<14;i++){const t=i*Math.PI/7;leaf(face+'-corner-wreath-leaf',a+Math.cos(t)*.26,8.22+Math.sin(t)*.26,.09,.14,.11,t,'trim',face,2);}
   for(const s of [-1,1])for(let k=0;k<4;k++){const inner=a+s*.3,outer=a+s*(half-.08),pts=Array.from({length:7},(_,i)=>{const t=i/6;return[inner+(outer-inner)*t,8.42-k*.075-.17*Math.sin(Math.PI*t)-.05*t,.16+.008*k];});line(face+'-corner-drape',pts,.024,'trim',face,14,6);}
  }
  const head=new THREE.SphereGeometry(1,compact?8:12,compact?6:10);head.scale(.14,.18,.05);head.translate(a,8.22,.165);b.add(face+'-corner-mask',head,'trim',face);
  for(const s of [-1,1]){line(face+'-mask-brow',[[a+s*.018,8.26,.21],[a+s*.055,8.28,.212],[a+s*.09,8.255,.2]],.012,'trim',face);disk(face+'-mask-eye',a+s*.05,8.245,.013,.007,.211,'void',face);}
  shape(face+'-mask-nose',[[a-.025,8.25],[a+.025,8.25],[a+.018,8.175],[a-.018,8.175]],.045,.175,'trim',face,.004);
  for(let i=-2;i<=2;i++)leaf(face+'-mask-beard',a+i*.035,8.03,.07,.15,.11,-i*.16,'trim',face,2);
  inventory.push({id:face+'-corner-mask-'+a,face,type:'corner garland and mask',centre:[a,8.23]});
 }
 function quoinRun(face: Face,a: number,b: number,t: number,width=.24,projection=.13,id='quoin',stagger=1,joint=.012){
  const count=Math.max(1,Math.ceil((t-b)/.48)),pitch=(t-b)/count,bed=width*stagger/2;
  // Without this bed the joints between the blocks show the yellow wall behind them.
  box(id+'-bed',a-bed,a+bed,b,t,-.02,projection*.6,'trim',face);
  for(let i=0;i<count;i++){const half=width*(i%2?stagger:1)/2;box(id+'-'+i,a-half,a+half,b+i*pitch+joint,b+(i+1)*pitch-joint,-.02,projection+(i%2)*.012,'trim',face);}
 }
 function lyre(face: Face,a: number,y: number,scale=1,d=.21,id='lyre',tall=scale){
  const P=(x: number,h: number,z=d)=>[a+x*scale,y+h*tall,z];
  for(const s of [-1,1])line(id+'-arm',[[s*.5,.18],[s*.72,.55],[s*.68,1.02],[s*.47,1.48]].map(([x,h])=>P(x,h)),.065*scale,'trim',face,20,7);
  line(id+'-crossbar',[P(-.5,1.27),P(.5,1.27)],.045*scale,'trim',face);
  for(let i=-2;i<=2;i++)line(id+'-string',[P(i*.17,.27),P(i*.17,1.51)],.013*scale,'trim',face,3,5);
  ring(id+'-soundbox',a,y+.2*tall,.50*scale,.16*tall,d,.045*scale,'trim',face);
  for(const s of [-1,1]){
   const pts=Array.from({length:13},(_,i)=>{const t=i/12;return P(s*(.68+.36*Math.sin(Math.PI*t)),.12+1.42*t,d-.015);});line(id+'-wreath-stem',pts,.032*scale,'trim',face,24,6);
   for(let i=0;i<9;i++){const t=(i+.5)/9,x=s*(.68+.36*Math.sin(Math.PI*t)),h=.12+1.42*t;for(const side of [-1,1])leaf(id+'-wreath-leaf',a+x*scale,y+h*tall,.17*scale,.29*scale,d-.005,s*(side*.75-.2),'trim',face,2);}
  }
  inventory.push({id,face,type:'lyre and laurel wreath',centre:[a,y]});
 }
 function sign(face: Face,a: number){
  const pts=lettering.points,types=lettering.types,path=new THREE.ShapePath(),xs=[],ys=[];for(let i=0;i<pts.length;i+=2){xs.push(pts[i]);ys.push(pts[i+1]);}const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const point=(i: number): [number,number]=>[a-((pts[i*2]-minX)/(maxX-minX)-.5)*3.2,9.03+(maxY-pts[i*2+1])/(maxY-minY)*.42];
  for(let i=0;i<types.length;i++){const type=types[i]&7,p=point(i);if(type===0)path.moveTo(...p);else if(type===1)path.lineTo(...p);else if(type===3){const q=point(i+1),r=point(i+2);path.bezierCurveTo(...p,...q,...r);i+=2;}if(types[i]&128)path.currentPath!.closePath();}
  const contours=path.subPaths.map(p=>({path:p,points:p.getPoints(compact?3:6)} as {path: THREE.Path; points: THREE.Vector2[]; depth: number})),inside=(p: THREE.Vector2,poly: THREE.Vector2[])=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)yes=!yes;return yes;};
  for(const c of contours)c.depth=contours.filter(o=>o!==c&&Math.abs(THREE.ShapeUtils.area(o.points))>Math.abs(THREE.ShapeUtils.area(c.points))&&inside(c.points[0],o.points)).length;
  const shapes=contours.filter(c=>c.depth%2===0).map(c=>{const s=new THREE.Shape(c.points);s.holes=contours.filter(h=>h.depth===c.depth+1&&inside(h.points[0],c.points)).map(h=>new THREE.Path(h.points));return s;}),g=new THREE.ExtrudeGeometry(shapes,{depth:.045,bevelEnabled:!compact,bevelSize:.004,bevelThickness:.004,bevelSegments:1,curveSegments:compact?3:6});g.translate(0,0,.035);b.add(face+'-lettering-РОДИНА',g,'sign',face);inventory.push({id:face+'-lettering',face,text:'РОДИНА',font:lettering.font+' outlines, approximate historic lettering',shapes:shapes.length,holes:shapes.reduce((n,s)=>n+s.holes.length,0),type:'raised Cyrillic lettering'});
 }
 for(const face of ['NNE','ESE'] as const){
  const layout=face==='NNE'?front:garden,{centre,bayHalf}=layout,blind=face==='NNE';
  for(const p of layout.pilasters)capital(face,p.x,p.width);
  for(const a of layout.rustication)quoinRun(face,a,plinthTop,8.55,layout.rusticationWidth,.12,face+'-central-rustication',.86,.02);
  for(const a of layout.doorPiers)quoinRun(face,a,plinthTop,4.1,.36,.1,face+'-door-pier');
  // The bay's horizontals continue the entrance lintel, relief band and sill levels.
  for(const a of layout.bays){
   for(const s of [-1,1])quoinRun(face,a+s*.96,plinthTop,blind?4.1:4.47,.32,.09,face+'-outer-jamb');
   if(blind){
    box(face+'-outer-head',a-1.12,a+1.12,4.1,4.45,-.02,.11,'trim',face);
    shape(face+'-outer-keystone',[[a-.25,4.1],[a+.25,4.1],[a+.32,4.46],[a-.32,4.46]],.17,-.02,'trim',face);
    box(face+'-outer-band',a-bayHalf,a+bayHalf,4.47,4.62,-.02,.09,'trim',face);
    box(face+'-outer-cap-step',a-1.12,a+1.12,5.56,5.83,-.02,.07,'trim',face);
    box(face+'-blind-outer-sill',a-.78,a+.78,1.16,1.3,-.02,.1,'trim',face);
    swag(face,a,1.1,1,.16,.05,face+'-blind-base-garland');
   }else{
    for(const s of [-1,1])box(face+'-outer-band',a+s*(.72+bayHalf)/2-(bayHalf-.72)/2,a+s*(.72+bayHalf)/2+(bayHalf-.72)/2,4.47,4.62,-.02,.09,'trim',face);
    box(face+'-outer-window-sill',a-.72,a+.72,3.6,3.7,-.02,.1,'trim',face);
   }
   const fluteTop=blind?5.54:5.72;
   for(const s of [-1,1]){box(face+'-outer-frieze-flute-bed',a+s*.96-.13,a+s*.96+.13,4.62,fluteTop,-.02,.08,'trim',face);for(const k of [-1,1])line(face+'-outer-flute',[[a+s*.96+k*.05,4.68,.08],[a+s*.96+k*.055,(4.68+fluteTop)/2,.085],[a+s*.96+k*.05,fluteTop-.06,.08]],.018,'concrete',face);}
   box(face+'-outer-frieze-cap',a-bayHalf,a+bayHalf,5.83,6.04,-.02,.11,'trim',face);
  }
  box(face+'-entrance-lintel',centre-1.15,centre+1.15,4.1,4.45,-.02,.1,'trim',face);
  shape(face+'-entrance-keystone',[[centre-.28,4.1],[centre+.28,4.1],[centre+.38,4.46],[centre-.38,4.46]],.16,-.02,'trim',face);
  for(const s of [-1,1])shape(face+'-entrance-lintel-wedge',[[centre+s*.33,4.1],[centre+s*.62,4.1],[centre+s*.8,4.46],[centre+s*.43,4.46]],.14,-.02,'trim',face);
  box(face+'-relief-lower-band',centre-2.25,centre+2.25,4.47,4.62,-.02,.12,'trim',face);
  box(face+'-relief-upper-sill',centre-2.25,centre+2.25,5.83,6.04,-.02,.13,'trim',face);
  for(const a of layout.roundels)roundel(face,a,5.2,.26,face+'-entry-roundel-'+a);
  for(const a of layout.reliefStrips){box(face+'-relief-strip-bed',a-.12,a+.12,4.62,5.83,-.02,.09,'trim',face);for(const k of [-1,1])line(face+'-relief-strip-flute',[[a+k*.045,4.72,.09],[a+k*.05,5.2,.095],[a+k*.045,5.72,.09]],.016,'concrete',face);}
  box(face+'-draped-panel-bed',centre-.84,centre+.84,4.7,5.72,-.02,.08,'trim',face);
  swag(face,centre,5.66,1.5,.38,.1,face+'-entrance-drape');lyre(face,centre,4.85,.38,.11,face+'-small-lyre');
  for(const a of layout.mullions){box(face+'-foyer-window-pilaster',a-.08,a+.08,6.04,8.4,-.02,.12,'trim',face);box(face+'-foyer-window-cap',a-.12,a+.12,8.39,8.52,-.02,.13,'trim',face);}
  // The ring's crown runs up behind the raking cornice, so the outer radius may exceed the tympanum.
  const blocks=13,outer=3.3,inner=2.2;
  for(let i=0;i<blocks;i++){const a=i*Math.PI/blocks+.012,c=(i+1)*Math.PI/blocks-.012,points=[];for(let j=0;j<=3;j++){const t=a+(c-a)*j/3;points.push([centre+outer*Math.cos(t),10.08+outer*Math.sin(t)]);}for(let j=3;j>=0;j--){const t=a+(c-a)*j/3;points.push([centre+inner*Math.cos(t),10.08+inner*Math.sin(t)]);}shape(face+'-arch-voussoir-'+i,points,.08,-.02,'trim',face);}
  shape(face+'-lyre-pedestal',[[centre-.66,10.08],[centre+.66,10.08],[centre+.46,10.4],[centre-.46,10.4]],.11,-.02,'trim',face);
  lyre(face,centre,10.42,.62,.08,face+'-gable-lyre',.95);sign(face,centre);
  box(face+'-apex-finial-stem',centre-.035,centre+.035,13.75,13.98,.03,.1,'metal',face);
  const finial=new THREE.SphereGeometry(.13,compact?8:12,compact?6:10);finial.translate(centre,14.03,.065);b.add(face+'-apex-finial',finial,'metal',face);
 }
 const wide=front.pierWidth;
 for(const[face,a,width]of [['NNE',front.piers[0],wide],['NNE',front.piers[1],wide],['ESE',garden.piers[0],wide],['ESE',garden.piers[1],wide],['SSW',.625,1.25],['SSW',front.piers[1],wide],['WNW',garden.piers[0],wide],['WNW',21.025,1.25]] as const)cornerPanel(face,a,width);
 const rows: [Face,number[],number[]][]=[['WNW-NNE',[-3.9,-11.05,-18.2],[-7.4,-14.6,-21.4]],['WNW-SSW',[-3.9,-11.05,-18.2],[-7.4,-14.6,-21.4]],['SSW-ESE',[27.2,33.3,39.4],[24.2,30.25,36.35,43.0]],['SSW-WNW',[27.2,33.3],[24.2,30.25,36.35]],['WNW-end',[10.68],[6.4,15.3]],['SSW-end',[11.15],[6.2,15.7]]];
 for(const[face,bays,roundels]of rows){for(const a of roundels)roundel(face,a,5.35,.31,face+'-roundel-'+a);for(const a of bays){for(const s of [-1,1])quoinRun(face,a+s*(a===-18.2||a===39.4?1.035:1.26),bayBase(face),4.5,.22,.115,face+'-bay-quoin');for(const s of [-1,1])for(let k=-1;k<=1;k++)line(face+'-frieze-reed',[[a+s*.87+k*.055,4.93,.02],[a+s*.9+k*.05,5.35,.05],[a+s*.86+k*.05,5.83,.02]],.016,'trim',face,14,5);box(face+'-frieze-bay-crown',a-1.5,a+1.5,5.88,6.16,.01,.13,'trim',face);}}
 box('SSW-end-blind-base-relief',11.15-1.13,11.15+1.13,.22,.61,-.02,.12,'trim','SSW-end');swag('SSW-end',11.15,.56,1.95,.19,.17,'SSW-end-blind-end-swag');
 box('WNW-end-blind-sill',10.68-1.04,10.68+1.04,1,1.14,-.02,.15,'trim','WNW-end');swag('WNW-end',10.68,.94,.95,.16,.05,'WNW-end-blind-end-swag');
 return inventory;
}
