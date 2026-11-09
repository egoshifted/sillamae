import type {Point2} from '../../../engine/types.ts';
import {vertices as survey, wallFaces as surveyWalls, roofFaces as surveyRoof, type SurveyPoint} from './survey-shell.ts';

export const length=Math.hypot(30.72,15.01), width=17.876, wing=9.242, setback=1.3;
const dx=30.72/length,dz=15.01/length;
export const planPoint=(u:number,v:number):Point2=>[302.4+dx*u+dz*v,555.92+dz*u-dx*v];
export const footprint:Point2[]=[[0,0],[wing,0],[wing,setback],[length-wing,setback],[length-wing,0],[length,0],[length,width],[0,width]].map(([u,v])=>planPoint(u,v));
const toLocal=([x,z,h]:SurveyPoint):SurveyPoint=>[(x-302.4)*dx+(z-555.92)*dz,(x-302.4)*dz-(z-555.92)*dx,h];
const local=survey.map(toLocal), oldInner=local[53][0];
// The 2024 front view shows one level, straight inner eave until the main pitch meets it.
// The aerial distinguishes its endpoint from the higher valley junction (56/76).
for(const i of [6,7,55])local[i][0]=oldInner;
for(const i of [1,2,6,32,34,47,55])local[i][2]=25.70;
// The marked aerial and side Street View resolve a narrow, steeper end gable.
for(const i of [32,33])local[i][1]=8.15;
local[33][2]=27.65;
const innerEave=local.length;
local.push([oldInner,6.72,25.70]);
const sideShoulder=local.length;
local.push([length,6.0,25.70]);
// Survey paint subdivisions introduce a crease in the otherwise planar rear pitch.
local[15][1]=local[36][1]=width;local[15][2]=local[35][2]=local[36][2]=22.55;
local[36][0]=length;local[49][1]=local[78][1];
const hipHeight=(u:number)=>27.4+(22.55-27.4)*(u-local[78][0])/(length-local[78][0]);
local[76][2]=hipHeight(local[76][0]);
const rearJunction=local.length;
local.push([local[78][0]+(27.4-25.70)/(27.4-22.55)*(length-local[78][0]),local[34][1],25.70]);
// Street View resolves a complete outer-plane gable. The survey folds its front half
// inward onto the hip; replace that triangle and the two roof facets it interrupts.
const foldedWalls=['42,32,33','2,3,4','0,2,4','0,4,5','0,5,6','38,39,5','5,4,38','40,39,38','2,41,3','57,58,59','60,57,59'];
const foldedReturnWalls=['43,44,45','46,47,45','45,43,46','35,34,47','47,46,35'];
const walls=surveyWalls.filter(f=>!foldedWalls.includes(f.join(','))&&!foldedReturnWalls.includes(f.join(','))&&f.join(',')!=='56,53,55').concat([[sideShoulder,33,32],[0,2,4],[0,4,6],[innerEave,53,55],[35,34,rearJunction]]);
const foldedRoof=['32,1,58','58,42,32','1,2,41','1,41,57','57,58,1','4,38,40','40,60,57','40,57,41','4,40,41','41,3,4','6,55,56','6,56,42','6,42,58','6,58,59','6,59,60','60,40,39','6,60,39','39,5,6'];
const rearRoof=['15,36,77','15,77,78','78,49,79','78,79,15','15,79,49','15,49,50','15,50,51','15,51,24','15,24,22','22,21,15','76,44,45','76,45,47','76,47,34','35,46,43','44,76,78','44,78,77','43,44,77','35,43,77','77,36,35'];
const roofs=surveyRoof.filter(f=>!foldedRoof.includes(f.join(','))&&!rearRoof.includes(f.join(','))&&f.join(',')!=='63,56,53').concat([[sideShoulder,1,58],[33,sideShoulder,58],[33,58,42],[1,2,58],[2,4,58],[4,6,innerEave],[4,innerEave,56],[4,56,58],[56,42,58],[63,innerEave,53],[63,56,innerEave],[15,36,78,49],[76,rearJunction,34],[rearJunction,76,78],[rearJunction,78,36],[35,rearJunction,36]]);
function fit([u,v,h]:SurveyPoint):SurveyPoint {
  u=u>=oldInner?length-(length-u)*wing/(length-oldInner):length/2+(u-length/2)*(length/2-wing)/(oldInner-length/2);
  if(Math.abs(u-length)<.05)u=length;
  if(Math.abs(v)<.01)v=0;
  if(Math.abs(v-setback)<.09)v=setback;
  if(Math.abs(v-width)<.05)v=width;
  return [u,v,h];
}
function half(face:number[]):SurveyPoint[] {
  const poly=face.map(i=>local[i]),out:SurveyPoint[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]-length/2,db=b[0]-length/2;
    if(da>=0)out.push(a);
    if(da*db<0){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t) as SurveyPoint);}
  }
  return out.map(fit);
}
// Fotoladu south views (2021/2022) show matching end roofs. Retain the clearer SE survey form,
// mirror about the surveyed centreline, and fit its perimeter by at most 0.25 m.
function symmetric(faces:number[][]):SurveyPoint[][] {
  return faces.flatMap(face=>{
    const p=half(face);if(p.length<3)return [];
    const world=(p:SurveyPoint[]):SurveyPoint[]=>p.map(([u,v,h])=>[...planPoint(u,v),h]);
    return [world(p),world(p.map(([u,v,h])=>[length-u,v,h] as SurveyPoint).reverse())];
  });
}
export const wallPolygons=symmetric(walls), roofPolygons=symmetric(roofs);
