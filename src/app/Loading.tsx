import type {Progress} from './town.ts';

// Sillamäe's arms: a stepped golden bridge on blue, in a 250 × 290 shield. The
// bridge is laid as columns counted out from the keystone.
const SHIELD = 'M3 3H247V172C247 222 192 262 125 288C58 262 3 222 3 172Z';
// Centred by its box, the square top corners crowd the ring while the point leaves a
// gap below. Centring here puts both corners and point 168.6 from the ring's centre.
const CX = 125, CY = 119.4;
const STEP = 16.3, RISE = 17.6, TOP = 42, BAND = 71, COLUMNS = 8, LAY = .12;
const blocks = Array.from({length: COLUMNS}, (_, i) => i).flatMap(i => (i ? [-1, 1] : [0]).map(side => ({
  key: `${i}${side}`,
  x: side ? 125 + side * (STEP / 2 + (i - 1) * STEP) - (side < 0 ? STEP : 0) : 125 - STEP / 2,
  y: TOP + RISE * i,
  // From both banks in to the keystone.
  delay: (COLUMNS - 1 - i) * LAY,
})));

export function Loading({progress}: {progress: Progress}) {
  const share = progress.viewTiles ? Math.min(1, progress.loaded / progress.viewTiles) : 0;
  return <div id="loading" role="progressbar" aria-label="Loading the town" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
    <svg viewBox={`${CX - 210} ${CY - 210} 420 420`} aria-hidden="true">
      <defs><clipPath id="loading-shield"><path d={SHIELD}/></clipPath></defs>
      <circle className="track" cx={CX} cy={CY} r="200"/>
      <circle className="ring" cx={CX} cy={CY} r="200" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - share * 100} transform={`rotate(-90 ${CX} ${CY})`}/>
      <path className="field" d={SHIELD}/>
      {/* Blocks overlap slightly so no hairline shows between columns. */}
      <g clipPath="url(#loading-shield)">{blocks.map(b => <rect key={b.key} className="block" x={b.x - .3} y={b.y} width={STEP + .6} height={BAND} style={{animationDelay: b.delay + 's'}}/>)}</g>
    </svg>
    <p>Loading the town</p>
  </div>;
}
