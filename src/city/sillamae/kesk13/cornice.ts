import {eaves, type RoofShape, type SurveyPoint} from './design.ts';

export const corniceProjection = .20, corniceHeight = .18;

export function wallCorners(eavePoints: readonly SurveyPoint[] = eaves): SurveyPoint[] {
  return eavePoints.map((point, i) => {
    const before = eavePoints[(i + eavePoints.length - 1) % eavePoints.length], after = eavePoints[(i + 1) % eavePoints.length];
    const a = [point[0] - before[0], point[1] - before[1]], b = [after[0] - point[0], after[1] - point[1]];
    const al = Math.hypot(...a), bl = Math.hypot(...b);
    const na = [-a[1] / al, a[0] / al], nb = [-b[1] / bl, b[0] / bl];
    const k = corniceProjection / (1 + na[0] * nb[0] + na[1] * nb[1]);
    return [point[0] + (na[0] + nb[0]) * k, point[1] + (na[1] + nb[1]) * k, point[2]];
  });
}

export function addCornice(inner: readonly SurveyPoint[], vertex: (p: SurveyPoint) => void, part: (id: string, name: string) => void, eavePoints: readonly SurveyPoint[] = eaves, edgeHeights?: RoofShape['edgeHeights'], covered = false, breaks?: RoofShape['breaks']) {
  for (let i = 0; i < eavePoints.length; i++) {
    const j = (i + 1) % eavePoints.length;
    const heights = edgeHeights?.[i];
    const at = (p: SurveyPoint, h: number): SurveyPoint => [p[0],p[1],h];
    const oa = at(eavePoints[i],heights?.[0] ?? eavePoints[i][2]), ob = at(eavePoints[j],heights?.[1] ?? eavePoints[j][2]);
    const oc = at(inner[i],oa[2]), od = at(inner[j],ob[2]);
    const sections:readonly (readonly [number,number])[]=[[0,oa[2]],...(breaks?.[i]??[]),[1,ob[2]]];
    const mix=(a:SurveyPoint,b:SurveyPoint,t:number,h:number):SurveyPoint=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,h];
    for(let section=1;section<sections.length;section++) {
    const [u,hu]=sections[section-1],[v,hv]=sections[section];
    const a=mix(oa,ob,u,hu),b=mix(oa,ob,v,hv),c=mix(oc,od,u,hu),d=mix(oc,od,v,hv);
    const low = ([x, z, h]: SurveyPoint): SurveyPoint => [x, z, h - corniceHeight];
    const la = low(a), lb = low(b), lc = low(c), ld = low(d);
    part(`cornice-${i}`, `Edge ${i} cornice`);
    if (!covered) [c, d, b, c, b, a].forEach(vertex);
    [la, a, b, la, b, lb, lc, la, lb, lc, lb, ld].forEach(vertex);
    const previous = (i+eavePoints.length-1)%eavePoints.length;
    if (edgeHeights && Math.abs(a[2]-(edgeHeights[previous]?.[1] ?? eavePoints[i][2]))>1e-6) [a,la,lc,a,lc,c].forEach(vertex);
    if (edgeHeights && Math.abs(b[2]-(edgeHeights[j]?.[0] ?? eavePoints[j][2]))>1e-6) [b,d,ld,b,ld,lb].forEach(vertex);
  }
}
}
