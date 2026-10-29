import * as THREE from 'three';
import lettering from './lettering.js';

export function addRodinaOrnaments(b,{compact=false}={}){
 const {box,shape,line,ring,disk,leaf}=b,inventory=[];
 function swag(face,a,y,w,h,d=.23,id='swag'){
  for(let k=0;k<3;k++){const pts=Array.from({length:11},(_,i)=>{const t=i/10;return[a-w/2+w*t,y-h*Math.sin(Math.PI*t)-k*.035,d+.02*k];});line(id+'-drape-'+k,pts,.022,'trim',face,20,6);}
  for(const s of [-1,1]){disk(id+'-pin',a+s*w/2,y,.055,.045,d,'trim',face);leaf(id+'-fold',a+s*w/2,y-.26,.16,.28,d,s*.27,'trim',face,2);}
 }
 function roundel(face,a,y,r=.31,id='roundel'){
  disk(id+'-plate',a,y,r,.035,.145,'trim',face);ring(id+'-outer',a,y,r,r,.195,.022,'trim',face);ring(id+'-inner',a,y,r*.66,r*.66,.21,.014,'trim',face);
  for(let i=0;i<8;i++){const t=i*Math.PI/4;leaf(id+'-rosette-'+i,a+Math.cos(t)*r*.15,y+Math.sin(t)*r*.15,r*.43,r*.53,.21,t-Math.PI/2,'trim',face,2);}
  disk(id+'-heart',a,y,r*.12,.065,.23,'trim',face);
  if(!compact)for(const sx of [-1,1])for(const sy of [-1,1])leaf(id+'-corner',a+sx*r*.84,y+sy*r*.84,r*.28,r*.4,.15,Math.atan2(sy,sx)-Math.PI/2,'trim',face,2);
  inventory.push({id,face,centre:[a,y],type:'roundel'});
 }
 function capital(face,a){
  box(face+'-capital-neck',a-.40,a+.40,7.82,7.98,-.02,.26,'trim',face);
  shape(face+'-capital-basket',[[a-.39,7.94],[a+.39,7.94],[a+.50,8.43],[a-.50,8.43]],.29,-.02,'trim',face);
  box(face+'-capital-abacus',a-.57,a+.57,8.43,8.52,-.02,.36,'trim',face);
  box(face+'-capital-abacus-step',a-.52,a+.52,8.36,8.43,-.02,.32,'trim',face);
  function acanthus(x,y,w,h,d,angle){
   leaf(face+'-capital-acanthus',a+x,y,w,h,d,angle,'trim',face,4);
   if(!compact)for(const side of [-1,1])for(let j=1;j<=3;j++){const t=j/5,xx=a+x,yy=y+t*h;line(face+'-capital-leaf-vein',[[xx,yy,d+.06],[xx+side*w*.22,yy+h*.12,d+.07],[xx+side*w*.38,yy+h*.15,d+.04]],.006,'trim',face,6,4);}
   ring(face+'-capital-leaf-curl',a+x-Math.sin(angle)*h*.82,y+Math.cos(angle)*h*.82,w*.17,h*.09,d+.06,.012,'trim',face,0,Math.PI*1.35);
  }
  for(let i=-3;i<=3;i++)acanthus(i*.122,7.94,.19,.27,.29,-i*.07);
  for(let i=-2;i<=2;i++)acanthus(i*.18,8.09,.21,.29,.31,-i*.1);
  for(const x of [-.24,0,.24])acanthus(x,8.26,.19,.17,.32,-x*.5);
  for(const s of [-1,1]){const pts=Array.from({length:19},(_,i)=>{const t=i/18*Math.PI*2.1,r=.12*(1-i/23);return[a+s*(.38+Math.cos(t)*r),8.31+Math.sin(t)*r,.35];});line(face+'-capital-volute',pts,.035,'trim',face,28,7);}
  for(let i=0;i<6;i++){const t=i*Math.PI/3;leaf(face+'-capital-flower-petal',a,8.35,.045,.08,.355,t,'trim',face,1);}disk(face+'-capital-flower',a,8.35,.022,.055,.37,'trim',face);inventory.push({id:face+'-capital-'+a,face,type:'Corinthian capital',centre:[a,8.2]});
 }
 function cornerPanel(face,a){
  box(face+'-corner-pier',a-.625,a+.625,-.15,7.95,-.025,.14,'trim',face);
  box(face+'-corner-relief-bed',a-.625,a+.625,7.95,8.50,-.02,.19,'trim',face);
  box(face+'-corner-abacus',a-.68,a+.68,8.50,8.56,-.02,.24,'trim',face);
  swag(face,a,8.39,1.04,.23,.21,face+'-corner-garland');
  const head=new THREE.SphereGeometry(1,compact?8:12,compact?6:10);head.scale(.12,.16,.065);head.translate(a,8.22,.255);b.add(face+'-corner-mask',head,'trim',face);
  for(const s of [-1,1]){line(face+'-mask-brow',[[a+s*.018,8.26,.314],[a+s*.055,8.28,.316],[a+s*.09,8.255,.3]],.012,'trim',face);disk(face+'-mask-eye',a+s*.05,8.245,.013,.007,.314,'void',face);}
  shape(face+'-mask-nose',[[a-.025,8.25],[a+.025,8.25],[a+.018,8.175],[a-.018,8.175]],.055,.285,'trim',face,.004);
  for(let i=-2;i<=2;i++)leaf(face+'-mask-beard',a+i*.035,8.03,.07,.15,.265,-i*.16,'trim',face,2);
  inventory.push({id:face+'-corner-mask-'+a,face,type:'corner garland and mask',centre:[a,8.23]});
 }
 function quoinRun(face,a,b,t,width=.24,projection=.13,id='quoin'){
  const count=Math.max(1,Math.ceil((t-b)/.48)),pitch=(t-b)/count;
  for(let i=0;i<count;i++)box(id+'-'+i,a-width/2,a+width/2,b+i*pitch+.012,b+(i+1)*pitch-.012,-.02,projection+(i%2)*.012,'trim',face);
 }
 function lyre(face,a,y,scale=1,d=.21,id='lyre'){
  const P=(x,h,z=d)=>[a+x*scale,y+h*scale,z];
  for(const s of [-1,1])line(id+'-arm',[[s*.5,.18],[s*.72,.55],[s*.68,1.02],[s*.47,1.48]].map(([x,h])=>P(x,h)),.065*scale,'trim',face,20,7);
  line(id+'-crossbar',[P(-.5,1.27),P(.5,1.27)],.045*scale,'trim',face);
  for(let i=-2;i<=2;i++)line(id+'-string',[P(i*.17,.27),P(i*.17,1.51)],.013*scale,'trim',face,3,5);
  ring(id+'-soundbox',a,y+.2*scale,.50*scale,.16*scale,d,.045*scale,'trim',face);
  for(const s of [-1,1]){
   const pts=Array.from({length:13},(_,i)=>{const t=i/12;return P(s*(.68+.36*Math.sin(Math.PI*t)),.12+1.42*t,d-.015);});line(id+'-wreath-stem',pts,.032*scale,'trim',face,24,6);
   for(let i=0;i<9;i++){const t=(i+.5)/9,x=s*(.68+.36*Math.sin(Math.PI*t)),h=.12+1.42*t;for(const side of [-1,1])leaf(id+'-wreath-leaf',a+x*scale,y+h*scale,.17*scale,.29*scale,d-.005,s*(side*.75-.2),'trim',face,2);}
  }
  inventory.push({id,face,type:'lyre and laurel wreath',centre:[a,y]});
 }
 function sign(face,a){
  const pts=lettering.points,types=lettering.types,path=new THREE.ShapePath(),xs=[],ys=[];for(let i=0;i<pts.length;i+=2){xs.push(pts[i]);ys.push(pts[i+1]);}const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const point=i=>[a-((pts[i*2]-minX)/(maxX-minX)-.5)*4.0,8.99+(maxY-pts[i*2+1])/(maxY-minY)*.50];
  for(let i=0;i<types.length;i++){const type=types[i]&7,p=point(i);if(type===0)path.moveTo(...p);else if(type===1)path.lineTo(...p);else if(type===3){const q=point(i+1),r=point(i+2);path.bezierCurveTo(...p,...q,...r);i+=2;}if(types[i]&128)path.currentPath.closePath();}
  const contours=path.subPaths.map(p=>({path:p,points:p.getPoints(compact?3:6)})),inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)yes=!yes;return yes;};
  for(const c of contours)c.depth=contours.filter(o=>o!==c&&Math.abs(THREE.ShapeUtils.area(o.points))>Math.abs(THREE.ShapeUtils.area(c.points))&&inside(c.points[0],o.points)).length;
  const shapes=contours.filter(c=>c.depth%2===0).map(c=>{const s=new THREE.Shape(c.points);s.holes=contours.filter(h=>h.depth===c.depth+1&&inside(h.points[0],c.points)).map(h=>new THREE.Path(h.points));return s;}),g=new THREE.ExtrudeGeometry(shapes,{depth:.045,bevelEnabled:!compact,bevelSize:.004,bevelThickness:.004,bevelSegments:1,curveSegments:compact?3:6});g.translate(0,0,.035);b.add(face+'-lettering-РОДИНА',g,'sign',face);inventory.push({id:face+'-lettering',face,text:'РОДИНА',font:lettering.font+' outlines, approximate historic lettering',shapes:shapes.length,holes:shapes.reduce((n,s)=>n+s.holes.length,0),type:'raised Cyrillic lettering'});
 }
 for(const face of ['NNE','ESE']){
  const shift=face==='ESE'?.15:0;
  for(const a of [4.15,5.55,15.85,17.25])capital(face,a);
  for(const a of [6.75+shift,14.65+shift])quoinRun(face,a,-.1,8.55,1.1,.12,face+'-central-rustication');
  for(const a of [2.15+shift,19.25+shift]){
   for(const s of [-1,1])quoinRun(face,a+s*1.13,.55,5.25,.27,.13,face+'-outer-jamb');
   box(face+'-outer-head',a-1.38,a+1.38,5.25,5.45,-.02,.18,'trim',face);
   shape(face+'-outer-keystone',[[a-.25,5.25],[a+.25,5.25],[a+.32,5.48],[a-.32,5.48]],.20,-.02,'trim',face);
   for(const s of [-1,1]){box(face+'-outer-frieze-flute-bed',a+s*.93-.11,a+s*.93+.11,5.57,6.12,-.02,.14,'trim',face);for(let k=-1;k<=1;k++)line(face+'-outer-flute',[[a+s*.93+k*.048,5.58,.165],[a+s*.93+k*.05,5.82,.17],[a+s*.93+k*.045,6.1,.16]],.012,'trim',face);}
   box(face+'-outer-frieze-cap',a-1.4,a+1.4,6.12,6.3,-.02,.22,'trim',face);
   if(face==='NNE'){box(face+'-blind-outer-sill',a-1.11,a+1.11,.55,.71,-.02,.19,'trim',face);swag(face,a,.47,1.65,.16,.17,face+'-blind-base-garland');}
  }
  const centre=10.7+shift;
  box(face+'-entrance-lintel',7.43+shift,13.97+shift,4.1,4.45,-.02,.22,'trim',face);
  shape(face+'-entrance-keystone',[[centre-.28,4.1],[centre+.28,4.1],[centre+.38,4.46],[centre-.38,4.46]],.24,-.02,'trim',face);
  box(face+'-relief-lower-band',7.25+shift,14.15+shift,4.47,4.62,-.02,.28,'trim',face);
  box(face+'-relief-upper-sill',7.12+shift,14.28+shift,5.83,6.04,-.02,.36,'trim',face);
  for(const a of [8.35+shift,13.05+shift])roundel(face,a,5.23,.26,face+'-entry-roundel-'+a);
  box(face+'-draped-panel-bed',centre-1.25,centre+1.25,4.7,5.72,-.02,.12,'trim',face);
  swag(face,centre,5.66,2.24,.38,.20,face+'-entrance-drape');lyre(face,centre,4.85,.38,.24,face+'-small-lyre');
  for(const a of [7.3+shift,8.96+shift,12.42+shift,14.1+shift]){box(face+'-foyer-window-pilaster',a-.07,a+.07,6.04,8.4,-.02,.12,'trim',face);box(face+'-foyer-window-cap',a-.11,a+.11,8.39,8.52,-.02,.16,'trim',face);}
  const archCentre=face==='NNE'?11.3:10.95;
  for(let i=0;i<15;i++){const a=i*Math.PI/15+.009,c=(i+1)*Math.PI/15-.009,points=[];for(let j=0;j<=3;j++){const t=a+(c-a)*j/3;points.push([archCentre+3.24*Math.cos(t),10.08+3.24*Math.sin(t)]);}for(let j=3;j>=0;j--){const t=a+(c-a)*j/3;points.push([archCentre+2.64*Math.cos(t),10.08+2.64*Math.sin(t)]);}shape(face+'-arch-voussoir-'+i,points,.16,.005,'trim',face);}
  shape(face+'-lyre-pedestal',[[archCentre-.87,10.08],[archCentre+.87,10.08],[archCentre+.66,10.52],[archCentre-.66,10.52]],.15,.05,'trim',face);
  lyre(face,archCentre,10.55,1,.24,face+'-gable-lyre');sign(face,centre);
 }
 for(const[face,centres]of [['NNE',[.625,20.775]],['ESE',[.625,21.025]],['SSW',[.625,20.775]],['WNW',[.625,21.025]]])for(const a of centres)cornerPanel(face,a);
 const rows=[['WNW-NNE',[-3.9,-11.05,-18.2],[-7.4,-14.6,-21.4]],['WNW-SSW',[-3.9,-11.05,-18.2],[-7.4,-14.6,-21.4]],['SSW-ESE',[27.2,33.3,39.4],[24.2,30.25,36.35,43.0]],['SSW-WNW',[27.2,33.3],[24.2,30.25,36.35]],['WNW-end',[10.68],[6.4,15.3]],['SSW-end',[11.15],[6.2,15.7]]];
 for(const[face,bays,roundels]of rows){for(const a of roundels)roundel(face,a,5.35,.31,face+'-roundel-'+a);for(const a of bays){for(const s of [-1,1])quoinRun(face,a+s*(a===-18.2||a===39.4?1.035:1.26),face==='SSW-end'?.65:.2,4.5,.22,.115,face+'-bay-quoin');for(const s of [-1,1])for(let k=-1;k<=1;k++)line(face+'-frieze-reed',[[a+s*.87+k*.055,4.93,.18],[a+s*.9+k*.05,5.35,.22],[a+s*.86+k*.05,5.83,.18]],.016,'trim',face,14,5);box(face+'-frieze-bay-crown',a-1.5,a+1.5,5.88,6.16,.01,.235,'trim',face);}}
 for(const[face,a]of [['WNW-end',10.68],['SSW-end',11.15]]){box(face+'-blind-base-relief',a-1.13,a+1.13,.22,.61,-.02,.12,'trim',face);swag(face,a,.56,1.95,.19,.17,face+'-blind-end-swag');}
 return inventory;
}
