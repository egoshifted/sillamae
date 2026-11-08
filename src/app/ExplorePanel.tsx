import {useEffect, useState} from 'react';
import type {Engine} from '../engine/engine.ts';

const timeOfDay = (k: number) => k < .04 ? 'Sunrise' : k < .1 ? 'Early morning' : k < .4 ? 'Morning' : k < .6 ? 'Midday' : k > .96 ? 'Sunset' : k > .9 ? 'Evening' : k > .78 ? 'Late afternoon' : 'Afternoon';

export function ExplorePanel({engine}: {engine: Engine | null}) {
  const [detail, setDetail] = useState('');
  const [daylight, setDaylight] = useState(0);
  const [tilt, setTilt] = useState({canRaise: true, canLower: true});

  useEffect(() => {
    if (!engine) return;
    setDetail(engine.detail);
    setDaylight(Math.round(engine.clock.daylight * 100));
    const offDetail = engine.onDetailChange(setDetail);
    const offFrame = engine.onFrame(() => {
      const next = engine.camera.tilt;
      setTilt(old => old.canRaise === next.canRaise && old.canLower === next.canLower ? old : next);
    });
    return () => { offDetail(); offFrame(); };
  }, [engine]);

  const turn = (horizontal: number, vertical = 0) => {
    engine?.camera.turn(horizontal, vertical);
    engine?.requestRedraw();
  };
  return <section className="panel">
    <div className="panel-title">Explore Sillamäe <span id="status">{detail || 'Loading scene…'}</span></div>
    <label>Sunlight <input id="sun" type="range" min="0" max="100" value={daylight}
      onChange={e => { setDaylight(+e.target.value); engine?.clock.set(+e.target.value / 100); }}/><span id="time">{timeOfDay(daylight / 100)}</span></label>
    <div className="dial">
      <button id="tilt-up" title="Raise viewpoint 15 degrees" aria-label="Raise viewpoint 15 degrees" disabled={!tilt.canRaise} onClick={() => turn(0, 1)}><Tilt/></button>
      <button id="rotate-back" title="Rotate left 45 degrees" aria-label="Rotate left 45 degrees" onClick={() => turn(-1)}><Turn/></button>
      <span className="hub"/>
      <button id="rotate" title="Rotate right 45 degrees" aria-label="Rotate right 45 degrees" onClick={() => turn(1)}><Turn/></button>
      <button id="tilt-down" title="Lower viewpoint 15 degrees" aria-label="Lower viewpoint 15 degrees" disabled={!tilt.canLower} onClick={() => turn(0, -1)}><Tilt/></button>
    </div>
  </section>;
}

const Tilt = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 19 12.5 13.4 10.6 12 22.5 10.6 10.6 5 12.5Z"/></svg>;
// Drawn for the left button; the right one mirrors it in CSS.
const Turn = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path className="line" d="M23 17Q10 17 6 8"/><path d="M4 3.4 9.9 6.8 5.5 6.9 2.5 10.1Z"/></svg>;
