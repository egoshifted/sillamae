import type {AssetDefinition} from '../../../../engine/types.ts';
import * as THREE from 'three';
import {assemble, box, cylinder, graphic, palette} from '../../assets/palette.ts';
const face = () => graphic('residential-zone', c => {
  c.fillStyle = '#f0f1e8'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#195298'; c.fillRect(9, 9, 238, 238);
  c.strokeStyle = c.fillStyle = '#f0f1e8'; c.lineCap = 'round'; c.lineWidth = 9;
  const line = (p: number[][]) => { c.beginPath(); p.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke(); };
  c.beginPath(); c.moveTo(175, 89); c.lineTo(175, 53); c.lineTo(199, 27); c.lineTo(224, 53); c.lineTo(224, 89); c.closePath(); c.fill();
  c.fillStyle = '#195298'; c.fillRect(194, 61, 12, 28); c.fillStyle = '#f0f1e8';
  c.fillRect(57, 52, 63, 25); line([[64,52],[72,33],[105,33],[115,52]]); line([[64,74],[64,85]]); line([[113,74],[113,85]]);
  for (const [x,y,r] of [[64,113,10],[151,153,8],[202,217,7]]) { c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); }
  line([[64,130],[59,172],[40,216]]); line([[59,171],[83,214]]); line([[62,138],[40,161]]); line([[63,138],[89,158]]);
  c.lineWidth = 7; line([[151,168],[152,190],[134,218]]); line([[152,190],[177,211]]); line([[151,172],[134,185]]); line([[151,172],[173,185]]);
});
export const asset: AssetDefinition = {
  id:'sign-residential-01', name:'Residential zone sign', category:'signs', tags:['sign','street','residential','blue','õueala'], attach:'ground',
  size:[.6,2.65,.085], triangles:160, variants:[{id:'blue',label:'Blue sign'}],
  build({detail}) {
    return assemble([
      [cylinder(.03,.03,2.6,detail==='near'?10:6),palette.galvanised()],
      [box(.6,.6,.025,0,2.35,.0425),palette.galvanised()],
      [new THREE.PlaneGeometry(.59,.59).translate(0,2.35,.0551),face()],
    ],'sign-residential-01');
  },
};
