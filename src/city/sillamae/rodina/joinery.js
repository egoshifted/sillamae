import * as THREE from 'three';
import {frontOpenings,gardenOpenings,courtyardOpenings} from './plain-model.js';

export function addRodinaJoinery(b,plain,{compact=false}={}){
 const {box,line,ring}=b,inventory=[];
 function pane(face,id,a,bottom,w,h,broken=false,pale=false){
  const s=new THREE.Shape();s.moveTo(a-w/2,bottom);s.lineTo(a+w/2,bottom);s.lineTo(a+w/2,bottom+h);s.lineTo(a-w/2,bottom+h);s.closePath();
  if(broken){const hole=new THREE.Path();[[a-w*.3,bottom+h*.1],[a+w*.19,bottom+h*.14],[a+w*.32,bottom+h*.48],[a+w*.04,bottom+h*.36],[a-w*.12,bottom+h*.83],[a-w*.38,bottom+h*.68]].forEach(([x,y],i)=>i?hole.lineTo(x,y):hole.moveTo(x,y));hole.closePath();s.holes.push(hole);}
  const g=new THREE.ExtrudeGeometry(s,{depth:.008,bevelEnabled:false});g.translate(0,0,-.29);b.add(id+'-glass-pane',g,pale?'paleGlass':'glass',face);
 }
 function window(face,o,a=o.x){
  const innerW=o.w-.14,innerH=o.t-o.b-.14,cols=o.id.includes('C1')||o.id.includes('C3')||o.id.includes('COURT')?1:2,ys=o.id.includes('-C')?[0,.43,.78,1]:[0,.68,1];
  for(let c=0;c<cols;c++)for(let r=0;r<ys.length-1;r++){const w=innerW/cols-.035,h=innerH*(ys[r+1]-ys[r])-.035,x=a-innerW/2+(c+.5)*innerW/cols,bottom=o.b+.07+innerH*ys[r]+.018;pane(face,o.id,x,bottom,w,h,face==='ESE'&&o.id.includes('L2-C2')&&c===0&&r===1);}
  for(let c=1;c<cols;c++){const x=a-innerW/2+c*innerW/cols;box(o.id+'-mullion',x-.022,x+.022,o.b+.06,o.t-.06,-.285,-.19,'wood',face);}
  for(const y of ys.slice(1,-1)){const h=o.b+.07+y*innerH;box(o.id+'-transom',a-innerW/2,a+innerW/2,h-.023,h+.023,-.285,-.19,'wood',face);}
  box(o.id+'-folded-sill',a-o.w/2-.08,a+o.w/2+.08,o.b-.065,o.b-.025,-.3,.12,'metal',face);
  inventory.push({id:o.id,face,type:'window',a,bottom:o.b,top:o.t,columns:cols,rows:ys.length-1,broken:face==='ESE'&&o.id.includes('L2-C2'),recess:.282});
 }
 function door(face,o,a=o.x,mode='solid'){
  const count=o.w>1.5?2:1,leafW=(o.w-.14)/count;
  for(let c=0;c<count;c++){const x=a-o.w/2+.07+(c+.5)*leafW,left=x-leafW/2,right=x+leafW/2,bottom=o.b+.07,top=o.t-.07,glassBottom=bottom+.55;
   for(const[s,e]of [[left,left+.07],[right-.07,right]])box(o.id+'-door-stile',s,e,bottom,top,-.285,-.19,'door',face);
   box(o.id+'-door-bottom-rail',left+.07,right-.07,bottom,bottom+.12,-.285,-.19,'door',face);box(o.id+'-door-top-rail',left+.07,right-.07,top-.11,top,-.285,-.19,'door',face);
   box(o.id+'-door-lock-rail',left+.07,right-.07,glassBottom-.08,glassBottom+.02,-.285,-.19,'door',face);box(o.id+'-door-lower-panel',left+.11,right-.11,bottom+.16,glassBottom-.13,-.28,-.23,'door',face);
   const w=leafW-.18,h=top-.14-glassBottom;
   if(mode==='board'){box(o.id+'-tan-infill',x-w*.28,x+w*.28,glassBottom,top-.14,-.28,-.235,'board',face);box(o.id+'-infill-side-L',left+.07,x-w*.28,glassBottom,top-.14,-.28,-.24,'door',face);box(o.id+'-infill-side-R',x+w*.28,right-.07,glassBottom,top-.14,-.28,-.24,'door',face);}
   else if(mode==='solid'){box(o.id+'-solid-upper-panel',left+.11,right-.11,glassBottom,top-.14,-.28,-.235,'door',face);for(const yy of [glassBottom+.08,top-.23])box(o.id+'-panel-rail',left+.1,right-.1,yy-.025,yy+.025,-.235,-.195,'door',face);}
   else{pane(face,o.id,x,glassBottom,w,h,false,mode==='pale');if(mode==='wire'&&!compact)for(const sign of [-1,1])for(let k=-8;k<=8;k++){const yy=glassBottom+h/2+k*.19,pts=[];for(const xx of [x-w/2,x+w/2]){const y=yy+(xx-x)*sign*1.3;if(y>=glassBottom&&y<=glassBottom+h)pts.push([xx,y,-.265]);}for(const y of [glassBottom,glassBottom+h]){const xx=x+(y-yy)/(sign*1.3);if(xx>x-w/2&&xx<x+w/2)pts.push([xx,y,-.265]);}if(pts.length>=2)line(o.id+'-wire-glass',pts.slice(0,2),.0025,'iron',face,2,4);}}
   const hx=c===0?right-.12:left+.12,hy=bottom+(top-bottom)*.46;line(o.id+'-handle',[[hx,hy-.08,-.175],[hx,hy-.05,-.11],[hx,hy+.10,-.11],[hx,hy+.13,-.175]],.017,'metal',face,8,6);
  }
  inventory.push({id:o.id,face,type:'door',a,bottom:o.b,top:o.t,leaves:count,finish:mode});
 }
 function grille(o){const face='ESE',a=o.x,y=(o.b+o.t)/2,w=o.w-.15,h=o.t-o.b-.12,d=-.115;
  for(const s of [-1,1]){const cx=a+s*w*.245,cy=y;ring(o.id+'-grille-rosette',cx,cy,.13,.13,d,.012,'iron',face);for(const[dx,dy]of [[-.24,-.44],[0,-.55],[.24,-.44],[.25,.44],[0,.55],[-.25,.44]])line(o.id+'-grille-spoke',[[cx,cy,d],[cx+dx,cy+dy,d]],.011,'iron',face,2,5);for(const dy of [-.31,.31])ring(o.id+'-grille-scroll',cx,cy+dy,.09,.105,d,.01,'iron',face);}
  for(const x of [a-.055,a+.055])box(o.id+'-grille-centre-post',x-.013,x+.013,o.b+.07,o.t-.07,d-.015,d+.015,'iron',face);
  line(o.id+'-grille-perimeter',[[a-w/2,y-h/2+.12,d],[a-w/2+.13,y-h/2,d],[a+w/2-.13,y-h/2,d],[a+w/2,y-h/2+.12,d],[a+w/2,y+h/2-.12,d],[a+w/2-.13,y+h/2,d],[a-w/2+.13,y+h/2,d],[a-w/2,y+h/2-.12,d],[a-w/2,y-h/2+.12,d]],.018,'iron',face,16,6);
  inventory.push({id:o.id,face,type:'ornate double grille',leaves:2,fullRadialRange:true});
 }
 for(const[face,openings]of [['NNE',frontOpenings],['ESE',gardenOpenings]])for(const o of openings){if(o.type==='door')door(face,o,o.x,face==='NNE'?(o.w>1.5?'board':'pale'):'wire');else if(o.type==='basement'){pane(face,o.id,o.x,o.b+.07,o.w-.14,o.t-o.b-.14);grille(o);}else window(face,o);}
 for(const o of courtyardOpenings.WNW){const a=21.65-o.x;if(o.type==='door')door('WNW',o,a);else window('WNW',o,a);}
 for(const o of courtyardOpenings.SSW){const a=21-o.x;if(o.type==='door')door('SSW',o,a);else window('SSW',o,a);}
 for(const e of plain.userData.audit.access.exits)door(e.face,{id:e.id,x:e.centre,w:1.1,b:e.top,t:e.top+2.35},e.centre);
 for(const a of [8.5,13.2]){box('ESE-entrance-light-bracket',a-.025,a+.025,4.42,4.52,.02,.18,'iron','ESE');box('ESE-entrance-light',a-.14,a+.14,4.43,4.57,.14,.27,'metal','ESE');box('ESE-entrance-light-lens',a-.105,a+.105,4.45,4.55,.27,.279,'paleGlass','ESE');}
 return inventory;
}
