import type {Point2} from '../../../engine/types.ts';

// Survey outline in tower-local x/z, simplified and chamfered at the narrow white corner window seen in the owner photos.
// Owner correction: the courtyard wall between the tower and the street wing stands half a metre further in than the survey edge.
export const annexOutline:Point2[]=[[-13.25,-4.65],[-16.82,-6.54],[-24.48,-10.83],[-29.85,-9.28],[-35.79,1.09],[-31.39,3.73],[-32.62,5.85],[-28.29,8.46],[-27.79,7.8],[-22.27,10.87],[-21.17,10.57],[-18.35,4.75],[-13.25,4.75]];
// Owner close garage photos: the upper brick box is wider than the garage wall and cantilevers towards the street on a hollow-core slab (round cores show on its edge), carried by a concrete corbel at each front corner.
// Along the garage wall, from its left corner: box −.31 to 5.72, cores .1–4.9, corbels −.31–.56 and 5.0–5.72. Projection and depth inferred from the oblique photos.
export const annexDesign={wall:.28,base:5.8,roof:13.1,parapet:13.55,garageTop:14.4,
  garage:{left:-.31,right:5.72,projection:.9,depth:2.45,slabBottom:12.9,slabTop:13.25,cores:[.1,4.9,19] as const,corbels:[[-.31,.56],[5,5.72]] as const,corbelBottom:12.6},
  // Survey wall tops, matching the owner street photos: the upper volume has a near-flat roof falling to the street (17.17 → 16.79), no gables.
  // Its street wall is a thicker brick blade carried 2 m further west, its top rising towards the tower from 17.44 at the survey's slope.
  // Owner east and street photos: the rise peaks about 2 m short of the tower end, then falls steeply to the upper roof; the survey's 18.98 end is not seen.
  // Order: back-left, back-right, front-right, front-left; the front edge is the blade.
  upper:[[-25.98,-5.84],[-21.57,-3.55],[-23.94,1.01],[-28.35,-1.28]] as Point2[],upperFront:16.79,upperBack:17.17,
  blade:{from:[-30.04,-2.32] as Point2,to:[-24.03,.96] as Point2,thickness:.44,low:17.44,peakU:4.9,peak:18.5,end:16.85,
    // Owner photos: a sunk cross .75 m in from the low end; a small metal cross stands on the peak.
    cross:{u:.75,y:16.55,height:1,width:.62,bar:.07}},
  // Owner west-corner photos (street and sea side both see it face-on): the sea corner is cut back on the diagonal, faced with a grey concrete panel from the ground,
  // and capped by a small brick box cantilevered on a concrete slab; a concrete ledge runs the street wall from the cut. Chamfer frame: u along the cut, depth outward.
  // Owner close photos of both chamfers: each is a roof outlet, two metal-capped brick blades with an open gap and a dark chute down onto a projecting concrete slab.
  // Owner west-corner photo: one stone ledge runs at a single level from the stair wall round the landing's end, along the sea wall to the panel, and on along the street wall.
  westCorner:{cut:.78,drain:{slabBottom:12.45,slabTop:12.75,front:.2,top:13.8},ledge:{from:.8,bottom:9.02,top:9.46,projection:.14}},
  // Owner close photo: the blades rise about .3 m above the parapet.
  eastCorner:{slabBottom:12.65,slabTop:12.85,front:.35,top:13.85},
  // Plan depth of each outlet behind its chamfer face: blades and the roof notch.
  drain:{blade:.18,bladeDepth:.75,notch:.85},
  // Survey wall tops 14.55–14.64 on the rear and sea walls, 13.2 for the last stretch of the sea wall; owner west photo: the sea wall steps down there with a concrete block.
  // The raised rear body runs from that step along the street direction to the vent block, then round the upper volume to the rear corner; roof level from the survey bases.
  rearBody:{top:14.6,roof:14.3,step:2.3},
  // Owner sea-side photos, along edge 3 from the rear corner (u) and out from the wall (depth): the stair runs down past the rear corner inside one solid brick wall,
  // whose concrete coping is flat at the foot, slopes up, rises at a post and runs level round the landing; stepped concrete ledges follow it.
  // Owner south and north-west photos: the flight is about 2.2 m wide and ends near the rear corner; the frontal photo's stair wall stands nearer the camera than the house wall, so its positions are corrected for that depth.
  // Heights: house-wall features scaled from the 14.6 parapet (the wall's foot is hidden behind the stair wall), stair-wall features from its own foot on the ground.
  // Owner south photo: the east rear wing (edge 1) repeats this mirrored about the centre wall, so positions run from the corner with the centre wall.
  wings:[
    {edge:3,mirror:false,name:'sea',bottom:0,landing:[6.1,9.34],floor:9.9,depth:2.5,wall:.3,flat:1.46,slopeTop:5.86,copingLow:8.9,copingHigh:10.25,parapet:10.6,
      ledges:[[.1,1.46,8.05],[1.46,3.51,8.3],[3.51,5.61,8.62],[5.61,7.81,8.9],[7.81,9.48,9.24]],
      canopy:{from:6.3,to:9.5,projection:1,bottom:12.19,top:12.47,corbels:[[6.3,6.8],[8.6,9.2]],corbelBottom:11.7,piers:[[6.2,6.65]],pierTop:13.45}},
    // Owner frontal east-wing photo, from the corner with the centre wall: the landing runs on past the bend to the tower (edge 0 is nearly in line), one long ledge, a pier at each canopy end.
    {edge:1,mirror:true,name:'rear',bottom:.27,landing:[7,12.15],floor:10,depth:2.5,wall:.3,flat:1.89,slopeTop:8.44,copingLow:9.24,copingHigh:10.78,parapet:11.22,
      ledges:[[1.95,12.15,8.73]],
      canopy:{from:6.48,to:9.04,projection:1,bottom:12.22,top:12.62,corbels:[[6.5,7],[8.5,8.9]],corbelBottom:11.66,piers:[[6.35,7.02],[8.71,9.32]],pierTop:13.2}},
  ] as {edge:number,mirror:boolean,name:string,bottom:number,landing:[number,number],floor:number,depth:number,wall:number,flat:number,slopeTop:number,copingLow:number,copingHigh:number,parapet:number,
    ledges:[number,number,number][],canopy:{from:number,to:number,projection:number,bottom:number,top:number,corbels:[number,number][],corbelBottom:number,piers:[number,number][],pierTop:number}}[],
  // Owner frontal east-wing photo: two small doors open on the long landing, each under a thin concrete hood; along edge 0 from the tower.
  smallDoorHood:{over:.08,projection:.3,thickness:.13},
  // Owner rear photos: a concrete base course along the rear walls; the centre rear wall is set back between two flush strips at its corners.
  rearPlinth:{height:.55,proud:.05},rearRecess:{from:.67,to:4.92,depth:.12},
  // Survey: a low vent block in front of the upper volume; owner frontal photo: four round vents in its street face.
  ventBlock:{outline:[[-28.25,2.33],[-24.76,4.22],[-24.43,3.59],[-27.01,2.19]] as Point2[],top:15.7,vents:[.85,1.48,1.98,2.98],ventHeight:15.35},
  // Absolute source heights; unlike the tower above its plinth, this low wing does not inherit the tower lift.
  basement:{floor:6.1,door:11,u:.8,width:1.0,head:8.1,low:[-17.55,4.75] as Point2,high:[-19.85,10] as Point2,widthAtPlan:1.4,platformFront:5.8,
    // Owner correction: the platform runs right up to the tower's side wall (x −13.25); it ends a few cm inside it so no seam shows.
    platformRight:-13.2,coping:.08},
};
export interface AnnexOpening {id:string;edge:number;u:number;width:number;bottom:number;top:number;kind:'window'|'arch'|'door'|'gate';white?:boolean;grid?:boolean;columns?:number}
export function annexSchedule():AnnexOpening[] {
  const rows:AnnexOpening[]=[];
  // Owner street photo, in window widths: 2.18 tall, centres 1.73 apart, heads 1.9 below the parapet.
  for(const [i,u] of [1.63,3.05,4.47].entries())rows.push({id:'annex-street-window-'+i,edge:8,u,width:.82,bottom:10.2,top:12,kind:'window',white:true});
  rows.push({id:'annex-corner-window',edge:9,u:.57,width:.68,bottom:10.05,top:12.0,kind:'window',white:true});
  for(const [i,u] of [1.55,3.45].entries())rows.push({id:'annex-courtyard-window-'+i,edge:11,u,width:1.05,bottom:10.25,top:12.05,kind:'window'});
  rows.push({id:'annex-basement-door',edge:11,u:annexDesign.basement.u,width:1,bottom:6.1,top:8.1,kind:'door'});
  // Owner frontal garage photo: 1.22 m of brick left of the red steel gate, .78 m right of it.
  rows.push({id:'annex-garage',edge:6,u:2.74,width:3.04,bottom:7.9,top:10.3,kind:'gate'});
  // Owner frontal rear photo: the big white-framed arch sits centred in the recessed panel of the centre rear wall, one mullion.
  rows.push({id:'annex-rear-arch',edge:2,u:2.74,width:2.28,bottom:9.8,top:12.84,kind:'arch',grid:true,columns:2,white:true});
  // Owner frontal sea-side photo, from the rear corner: one gridded arch, then the door on the stair landing; the east rear wing mirrors it.
  const wingLength=Math.hypot(annexOutline[2][0]-annexOutline[1][0],annexOutline[2][1]-annexOutline[1][1]);
  rows.push({id:'annex-sea-arch',edge:3,u:3.8,width:1.8,bottom:10.66,top:12.9,kind:'arch',grid:true,columns:3});
  rows.push({id:'annex-rear-side-arch',edge:1,u:wingLength-3.75,width:1.9,bottom:10.56,top:13.13,kind:'arch',grid:true,columns:2,white:true});
  rows.push({id:'annex-rear-door',edge:1,u:wingLength-7.7,width:1.2,bottom:10,top:11.96,kind:'door'});
  for(const [i,u,width] of [[1.82,.75],[3.42,.62]].map(([u,w],i)=>[i,u,w]))rows.push({id:'annex-rear-small-door-'+i,edge:0,u,width,bottom:10,top:12.03,kind:'door'});
  rows.push({id:'annex-sea-door',edge:3,u:7.72,width:1.42,bottom:9.9,top:11.97,kind:'door'});
  return rows;
}
