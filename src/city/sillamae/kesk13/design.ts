export type SurveyPoint = readonly [x: number, z: number, elevation: number];

export const baseElevation = 15.12;
export const eaves: SurveyPoint[] = [
  [404.64, 640.25, 23.91], [388.02, 673.62, 23.86],
  [376.02, 667.62, 23.77], [384.40, 650.81, 23.75],
  [386.71, 651.97, 25.20], [389.12, 647.12, 25.19],
  [367.21, 636.15, 23.84], [373.45, 625.03, 24.10],
];

export const ridges: SurveyPoint[] = [
  [395.91, 643.21, 27.68], [385.44, 664.37, 27.65], [377.60, 634.06, 27.68],
];

// Eaves 0–7, then the ridge junction and the two hip ends.
export const roofPlanes = [
  [0, 1, 9, 8], [1, 2, 9], [2, 3, 4], [2, 4, 8, 9],
  [4, 5, 8], [5, 6, 8], [6, 10, 8], [6, 7, 10], [7, 0, 8, 10],
];

export interface RoofShape {
  breaks?: Readonly<Partial<Record<number, readonly (readonly [number,number])[]>>>;
  extra?: readonly SurveyPoint[];
  edgeHeights?: Readonly<Partial<Record<number, readonly [number,number]>>>;
  returns?: readonly (readonly number[])[];
  eaves: readonly SurveyPoint[];
  planes: readonly (readonly number[])[];
}

export const surveyRoof: RoofShape = {eaves, planes: roofPlanes};

// A level wing eave meets a higher recessed section; they have separate heights at the return.
const courtyardEaves = eaves.map(([x,z,h],i) => [x,z,i===2 || i===3 || i===6 ? 23.84 : h] as SurveyPoint);
export const levelCourtyardRoof: RoofShape = {
  eaves: courtyardEaves,
  extra: [[eaves[5][0],eaves[5][1],23.84]],
  edgeHeights: {5: [23.84,23.84]},
  planes: roofPlanes.map((p,i) => i===5 ? [11,6,8] : p),
  returns: [[11,5,8]],
};

const valleyFoot:SurveyPoint=[386.8148678470618,645.9658557865024,23.84];
const valleyFraction=Math.hypot(eaves[5][0]-valleyFoot[0],eaves[5][1]-valleyFoot[1])/Math.hypot(eaves[5][0]-eaves[6][0],eaves[5][1]-eaves[6][1]);
export const courtyardNotch:RoofShape={
 eaves:courtyardEaves,extra:[valleyFoot],breaks:{5:[[valleyFraction,23.84]]},
 planes:[...roofPlanes.map((p,i)=>i===5?[11,6,8]:p),[5,11,8]],
};
export function eaveHeight(shape:RoofShape,edge:number,t:number) {
 const ends=shape.edgeHeights?.[edge]??[shape.eaves[edge][2],shape.eaves[(edge+1)%shape.eaves.length][2]];
 const points:readonly (readonly [number,number])[]=[[0,ends[0]],...(shape.breaks?.[edge]??[]),[1,ends[1]]];
 for(let i=1;i<points.length;i++)if(t<=points[i][0]+1e-9){const a=points[i-1],b=points[i];return a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);}
 return ends[1];
}
