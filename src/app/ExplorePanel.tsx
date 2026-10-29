import {useEffect, useState} from 'react';
import type {Engine} from '../engine/engine.ts';

const timeOfDay = (k: number) => k < .3 ? 'Morning' : k > .75 ? 'Late afternoon' : 'Afternoon';

export function ExplorePanel({engine}: {engine: Engine | null}) {
  const [detail, setDetail] = useState('');
  const [daylight, setDaylight] = useState(58);
  const [tilt, setTilt] = useState({canRaise: true, canLower: true});

  useEffect(() => {
    if (!engine) return;
    setDetail(engine.detail);
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
    <div className="buttons small">
      <button id="rotate-back" title="Rotate left 45 degrees" onClick={() => turn(-1)}>← 45°</button>
      <button id="tilt-up" title="Raise viewpoint 15 degrees" disabled={!tilt.canRaise} onClick={() => turn(0, 1)}>↑ 15°</button>
      <button id="tilt-down" title="Lower viewpoint 15 degrees" disabled={!tilt.canLower} onClick={() => turn(0, -1)}>↓ 15°</button>
      <button id="rotate" title="Rotate right 45 degrees" onClick={() => turn(1)}>45° →</button>
    </div>
  </section>;
}
