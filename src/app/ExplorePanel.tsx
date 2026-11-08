import {useEffect, useState} from 'react';
import type {Engine} from '../engine/engine.ts';

const timeOfDay = (k: number) => k < .04 ? 'Sunrise' : k < .1 ? 'Early morning' : k < .4 ? 'Morning' : k < .6 ? 'Midday' : k > .96 ? 'Sunset' : k > .9 ? 'Evening' : k > .78 ? 'Late afternoon' : 'Afternoon';

export function ExplorePanel({engine}: {engine: Engine | null}) {
  const [daylight, setDaylight] = useState(0);
  const [tilt, setTilt] = useState({canRaise: true, canLower: true});

  useEffect(() => {
    if (!engine) return;
    setDaylight(Math.round(engine.clock.daylight * 100));
    const offFrame = engine.onFrame(() => {
      const next = engine.camera.tilt;
      setTilt(old => old.canRaise === next.canRaise && old.canLower === next.canLower ? old : next);
    });
    return offFrame;
  }, [engine]);

  const turn = (horizontal: number, vertical = 0) => {
    engine?.camera.turn(horizontal, vertical);
    engine?.requestRedraw();
  };
  const time = timeOfDay(daylight / 100);
  return <section className="panel">
    <label title={'Sunlight: ' + time}><HalfSun/><input id="sun" type="range" min="0" max="100" value={daylight} aria-label="Sunlight" aria-valuetext={time}
      onChange={e => { setDaylight(+e.target.value); engine?.clock.set(+e.target.value / 100); }}/><FullSun/></label>
    <div className="buttons small">
      <button id="rotate-back" title="Rotate left 45 degrees" onClick={() => turn(-1)}>← 45°</button>
      <button id="tilt-up" title="Raise viewpoint 15 degrees" disabled={!tilt.canRaise} onClick={() => turn(0, 1)}>↑ 15°</button>
      <button id="tilt-down" title="Lower viewpoint 15 degrees" disabled={!tilt.canLower} onClick={() => turn(0, -1)}>↓ 15°</button>
      <button id="rotate" title="Rotate right 45 degrees" onClick={() => turn(1)}>45° →</button>
    </div>
  </section>;
}

const rays = (angles: number[], y: number) => angles.map(a => {
  const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return <line key={a} x1={12 + 7 * c} y1={y - 7 * s} x2={12 + 10 * c} y2={y - 10 * s}/>;
});
const HalfSun = () => <svg className="sun-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17a5 5 0 0 1 10 0Z"/><g>{rays([0, 45, 90, 135, 180], 17)}<line x1="2" y1="20" x2="22" y2="20"/></g></svg>;
const FullSun = () => <svg className="sun-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><g>{rays([0, 45, 90, 135, 180, 225, 270, 315], 12)}</g></svg>;
