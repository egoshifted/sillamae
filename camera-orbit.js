export const MIN_ELEVATION=Math.PI/12;
export const MAX_ELEVATION=Math.PI/2;
// OrbitControls uses a tiny polar epsilon at the pole to retain a stable heading.
export const POLE_EPSILON=1e-6;
export function orbitStep(current,horizontal=0,vertical=0){
 return {theta:current.theta+horizontal*Math.PI/4,
 elevation:Math.max(MIN_ELEVATION,Math.min(MAX_ELEVATION,current.elevation+vertical*Math.PI/12)),radius:current.radius};
}
export function orbitOffset(orbit){
 const elevation=Math.min(orbit.elevation,MAX_ELEVATION-POLE_EPSILON),r=Math.cos(elevation)*orbit.radius;
 return [Math.sin(orbit.theta)*r,Math.sin(elevation)*orbit.radius,Math.cos(orbit.theta)*r];
}

// Keep atan2's wrapped heading on the current animation's continuous turn.
export function unwrapAngle(theta,reference=theta){return theta+Math.round((reference-theta)/(2*Math.PI))*2*Math.PI;}
