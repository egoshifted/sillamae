export const shellDesign={
 bays:[
  {face:'WNW-NNE',centres:[-3.9,-11.05,-18.2],exit:-18.2},
  {face:'WNW-SSW',centres:[-3.9,-11.05,-18.2],exit:-18.2},
  {face:'SSW-ESE',centres:[27.2,33.3,39.4],exit:39.4},
  {face:'SSW-WNW',centres:[27.2,33.3],exit:null},
  {face:'WNW-end',centres:[10.68],exit:null},
  {face:'SSW-end',centres:[11.15],exit:null}
 ],
 dormers:[
  ...[-5.4,-12,-18.6].map((centre,i)=>({id:'WNW-court-vent-'+(i+1),wing:'WNW',centre,front:16.1,depth:2,radius:.55,jamb:.2})),
  ...[27.3,33.8,40.3].map((centre,i)=>({id:'SSW-court-vent-'+(i+1),wing:'SSW',centre,front:5.35,depth:2,radius:.55,jamb:.2}))
 ],
 ladder:{u:-1.3,v:17.75,bottom:3.75,top:7.8,width:.6},
 limits:'Plain envelopes only. Bay widths, band levels, hood size/depth and ladder anchors inferred. Unseen outer courtyard bay, main-roof stacks and ornament remain unresolved.'
};

export function facadePoint(face,a,y,d=0){
 if(face==='WNW-NNE')return[a,y,3.93-d];
 if(face==='WNW-SSW')return[a,y,17.43+d];
 if(face==='SSW-ESE')return[17.8+d,y,a];
 if(face==='SSW-WNW')return[3.95-d,y,a];
 if(face==='WNW-end')return[-23.92-d,y,a];
 if(face==='SSW-end')return[a,y,45.47+d];
 if(face==='NNE')return[a,y,-d];
 if(face==='ESE')return[21.4+d,y,a];
 if(face==='SSW')return[a,y,21.65+d];
 if(face==='WNW')return[-d,y,a];
 throw Error('Unknown shell face '+face);
}

export function addShell(block,emit,materials){
 const {wall,frame,infill}=materials,inventory=[];
 function surface(name,points,normal,material=wall){
  const p=points[0],q=points[1],r=points[2],u=q.map((v,i)=>v-p[i]),v=r.map((t,i)=>t-p[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],forward=cross.reduce((n,t,i)=>n+t*normal[i],0)>0;
  const ids=[];for(let i=1;i<points.length-1;i++)ids.push(...(forward?[0,i,i+1]:[0,i+1,i]));return emit(name,points,ids,material);
 }
 function box(face,name,a0,a1,b,t,d0,d1,material=wall){const p=facadePoint(face,a0,b,d0),q=facadePoint(face,a1,t,d1);return block(name,Math.min(p[0],q[0]),Math.max(p[0],q[0]),b,t,Math.min(p[2],q[2]),Math.max(p[2],q[2]),material);}
 for(const row of shellDesign.bays)for(const a of row.centres){
  const open=a===row.exit,width=open?1.85:2.3,b=row.face==='SSW-end'?.65:.2,t=4.5,j=.22,id=row.face+'-bay-'+a;
  box(row.face,id+'-left',a-width/2-j,a-width/2,b,t,-.025,.105);
  box(row.face,id+'-right',a+width/2,a+width/2+j,b,t,-.025,.105);
  const lintel=box(row.face,id+'-lintel',a-width/2-j,a+width/2+j,t,t+.22,-.025,.12),g=lintel.geometry,indices=g.index.array,normals=g.attributes.normal,keep=[];
  // The continuous band owns the shared top; retaining the lintel cap creates opposite coplanar faces.
  for(let i=0;i<indices.length;i+=3)if(normals.getY(indices[i])<.9)keep.push(...indices.slice(i,i+3));g.setIndex(keep);
  if(!open)box(row.face,id+'-sill',a-width/2,a+width/2,b,b+.14,-.025,.15);
  inventory.push({id,face:row.face,centre:a,type:open?'exit surround':'blind surround',width,bottom:b,top:t+.22});
 }
 const paths={WNW:d=>[[0,3.93-d],[-23.92-d,3.93-d],[-23.92-d,17.43+d],[0,17.43+d]],SSW:d=>[[3.95-d,21.65],[3.95-d,45.47+d],[17.8+d,45.47+d],[17.8+d,21.65]],pavilion:d=>[[-d,-d],[21.4+d,-d],[21.4+d,21.65+d],[-d,21.65+d],[-d,-d]]};
 function band(name,path,y0,y1,projection,{top=true,under=-.025}={}){
  const inner=path(-.025),outer=path(projection);
  for(let i=1;i<outer.length;i++){
   const a=outer[i-1],b=outer[i],c=inner[i-1],d=inner[i],normal=[b[1]-a[1],0,a[0]-b[0]],mid=[(a[0]+b[0])/2,0,(a[1]+b[1])/2],centre=name.startsWith('pavilion')?[10.7,0,10.825]:name.startsWith('WNW')?[-12,0,10.68]:[10.875,0,33.56];
   if(normal[0]*(mid[0]-centre[0])+normal[2]*(mid[2]-centre[2])<0){normal[0]*=-1;normal[2]*=-1;}
   surface(name+'-front-'+i,[[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]]],normal);
   if(top)surface(name+'-top-'+i,[[a[0],y1,a[1]],[b[0],y1,b[1]],[d[0],y1,d[1]],[c[0],y1,c[1]]],[0,1,0]);
   const lower=path(under);surface(name+'-under-'+i,[[a[0],y0,a[1]],[b[0],y0,b[1]],[lower[i][0],y0,lower[i][1]],[lower[i-1][0],y0,lower[i-1][1]]],[0,-1,0]);
  }
 }
 for(const wing of ['WNW','SSW'])for(const[b,t,p,label,profile]of [[4.72,4.88,.14,'lower-frieze',{}],[5.9,6.12,.17,'upper-frieze',{}],[6.98,7.14,.12,'eave-bed',{top:false}],[7.14,7.3,.28,'eave-crown',{under:.12}]])band(wing+'-'+label,paths[wing],b,t,p,profile);
 for(const[b,t,p,label,profile]of [[8.55,8.78,.18,'sign-band',{}],[9.65,9.82,.18,'pediment-bed',{top:false}],[9.82,10,.3,'pediment-crown',{under:.18}]])band('pavilion-'+label,paths.pavilion,b,t,p,profile);
 function rake(face,start,end,peak,h,r){
  const normal=facadePoint(face,0,0,1).map((v,i)=>v-facadePoint(face,0,0,0)[i]);
  for(const[a,b,ya,yb]of [[start,peak,h,r],[peak,end,r,h]]){
   const poly=[[a,ya],[b,yb],[b,yb-.3],[a,ya-.3]],front=poly.map(([x,y])=>facadePoint(face,x,y,.2)),back=poly.map(([x,y])=>facadePoint(face,x,y,0));
   surface(face+'-rake-face',front,normal);
   for(const i of [0,2]){const j=(i+1)%4;surface(face+'-rake-edge', [front[i],front[j],back[j],back[i]],[0,i===0?1:-1,0]);}
  }
 }
 rake('WNW-end',3.93,17.43,10.78,7.3,9.95);rake('SSW-end',3.95,17.8,11.15,7.3,9.95);
 for(const[face,end,peak]of [['NNE',21.4,11.3],['ESE',21.65,10.95],['SSW',21.4,11.3],['WNW',21.65,10.95]])rake(face,0,end,peak,10,13.8);
 function roofY(d,depth){return d.wing==='WNW'?7.3+(17.43-d.front+depth)*2.65/(17.43-10.78):7.3+(d.front+depth-3.95)*2.65/(11.15-3.95);}
 for(const d of shellDesign.dormers){
  const point=(a,y,s)=>d.wing==='WNW'?[d.centre+a,y,d.front-s]:[d.front+s,y,d.centre+a],normal=d.wing==='WNW'?[0,0,1]:[-1,0,0],y=roofY(d,0),n=12,arc=Array.from({length:n+1},(_,i)=>{const t=Math.PI-i*Math.PI/n;return[d.radius*Math.cos(t),d.jamb+d.radius*Math.sin(t)];});
  for(let i=1;i<arc.length;i++){
   const[a,ya]=arc[i-1],[b,yb]=arc[i];surface(d.id+'-hood', [point(a,y+ya,0),point(b,y+yb,0),point(b,roofY(d,d.depth),d.depth),point(a,roofY(d,d.depth),d.depth)],[0,1,0],frame);
   const ai=a*(d.radius-.09)/d.radius,bi=b*(d.radius-.09)/d.radius,yai=d.jamb+(ya-d.jamb)*(d.radius-.09)/d.radius,ybi=d.jamb+(yb-d.jamb)*(d.radius-.09)/d.radius;
   surface(d.id+'-arch-trim',[point(a,y+ya,0),point(b,y+yb,0),point(bi,y+ybi,0),point(ai,y+yai,0)],normal,wall);
   surface(d.id+'-arch-reveal',[point(ai,y+yai,0),point(bi,y+ybi,0),point(bi,y+ybi,.2),point(ai,y+yai,.2)],[-normal[0],-1,-normal[2]],wall);
  }
  for(const sign of [-1,1]){
   surface(d.id+'-cheek',[point(sign*d.radius,y,0),point(sign*d.radius,y+d.jamb,0),point(sign*d.radius,roofY(d,d.depth),d.depth)],d.wing==='WNW'?[sign,0,0]:[0,0,sign],frame);
   const a=sign>0?d.radius-.09:-d.radius,b=a+.09;surface(d.id+'-jamb',[point(a,y+.1,0),point(b,y+.1,0),point(b,y+d.jamb,0),point(a,y+d.jamb,0)],normal);
   const inner=sign*(d.radius-.09);surface(d.id+'-jamb-reveal',[point(inner,y+.1,0),point(inner,y+d.jamb,0),point(inner,y+d.jamb,.2),point(inner,y+.1,.2)],d.wing==='WNW'?[-sign,0,0]:[0,0,-sign]);
  }
  const innerR=d.radius-.09,opening=[[-innerR,.1],...arc.map(([a,h])=>[a*innerR/d.radius,d.jamb+(h-d.jamb)*innerR/d.radius]),[innerR,.1]];
  const centre=point(0,y+.2,.2);for(let i=1;i<opening.length;i++)surface(d.id+'-vent-backing',[centre,point(...[opening[i-1][0],y+opening[i-1][1],.2]),point(...[opening[i][0],y+opening[i][1],.2])],normal,infill);
  surface(d.id+'-vent-backing',[centre,point(innerR,y+.1,.2),point(-innerR,y+.1,.2)],normal,infill);
  surface(d.id+'-sill-face',[point(-d.radius,y,0),point(d.radius,y,0),point(d.radius,y+.1,0),point(-d.radius,y+.1,0)],normal);
  surface(d.id+'-sill-reveal',[point(-innerR,y+.1,0),point(innerR,y+.1,0),point(innerR,y+.1,.2),point(-innerR,y+.1,.2)],[0,1,0]);
  for(let h=.12;h<d.jamb+innerR-.04;h+=.105){const w=h<=d.jamb?innerR:Math.sqrt(innerR*innerR-(h-d.jamb)**2);surface(d.id+'-louvre',[point(-w,y+h,.12),point(w,y+h,.12),point(w,y+h+.025,.12),point(-w,y+h+.025,.12)],normal,frame);}
  inventory.push({...d,type:'arched roof vent',baseY:y,roofContactY:roofY(d,d.depth)});
 }
 const l=shellDesign.ladder;
 for(const u of [l.u-l.width/2,l.u+l.width/2]){
  block('courtyard-ladder-rail',u-.025,u+.025,l.bottom,l.top,l.v-.025,l.v+.025,frame);
  for(const y of [4.05,5.55,7.05])block('courtyard-ladder-bracket',u-.025,u+.025,y-.025,y+.025,17.405,l.v-.025,frame);
 }
 for(let y=l.bottom+.13;y<7.28;y+=.3)block('courtyard-ladder-rung',l.u-l.width/2+.025,l.u+l.width/2-.025,y-.018,y+.018,l.v-.018,l.v+.018,frame);
 return{inventory,ladder:l,limits:shellDesign.limits};
}
