// Offsets are metres from the centre line, rectified from near-front Street View of
// the Kesk front (door, sign and gable peak share one line). They are inferred, not
// surveyed. The garden front repeats the layout on its slightly wider wall.
const pier=2.2,bayInner=5.56;
const pilasters=[{offset:4,width:1.12},{offset:5.175,width:.77}];

export const plinthTop=.69;

export function facadeLayout(wallWidth: number){
 const centre=wallWidth/2,bayOffset=(centre-pier+bayInner)/2,bayHalf=(centre-pier-bayInner)/2,sides=[-1,1];
 return{
  centre,bayHalf,
  bays:sides.map(s=>centre+s*bayOffset),
  piers:[pier/2,wallWidth-pier/2],pierWidth:pier,
  pilasters:sides.flatMap(s=>pilasters.map(p=>({x:centre+s*p.offset,width:p.width}))),
  rustication:sides.map(s=>centre+s*2.79),rusticationWidth:1.05,
  sideDoors:sides.map(s=>centre+s*1.68),
  sideWindows:sides.map(s=>centre+s*1.55),
  mullions:sides.flatMap(s=>[.97,2.1].map(m=>centre+s*m)),
  doorPiers:sides.map(s=>centre+s*.96),
  roundels:sides.map(s=>centre+s*1.52),
  reliefStrips:sides.flatMap(s=>[.97,2.08].map(m=>centre+s*m)),
 };
}

export type FacadeLayout = ReturnType<typeof facadeLayout>;
export const front=facadeLayout(21.4),garden=facadeLayout(21.65);
