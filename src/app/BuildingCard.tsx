import {useEffect, useState} from 'react';
import type {Engine} from '../engine/engine.ts';
import type {Building} from '../engine/types.ts';

const CLICK_PX = 5, CLICK_MS = 500;

const area = (g: Building['g']) => Math.abs(g.reduce((s, p, i) => {
  const q = g[(i + 1) % g.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;

// A click without a drag selects the building under the pointer; Esc or a
// click on empty ground clears it.
export function BuildingCard({engine}: {engine: Engine}) {
  const [building, setBuilding] = useState(engine.selected);

  useEffect(() => {
    const canvas = engine.domElement;
    let down: {x: number; y: number; at: number} | null = null;
    const press = (e: PointerEvent) => { down = e.button === 0 ? {x: e.clientX, y: e.clientY, at: performance.now()} : null; };
    const release = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_PX || performance.now() - down.at > CLICK_MS) return;
      engine.select(engine.pickBuilding(e.clientX, e.clientY));
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') engine.select(null); };
    canvas.addEventListener('pointerdown', press);
    canvas.addEventListener('pointerup', release);
    addEventListener('keydown', key);
    const offSelect = engine.onSelect(setBuilding);
    return () => {
      canvas.removeEventListener('pointerdown', press);
      canvas.removeEventListener('pointerup', release);
      removeEventListener('keydown', key);
      offSelect();
    };
  }, [engine]);

  if (!building) return null;
  const zone = engine.zoneOf(building);
  return <aside className="building-card">
    <div className="card-title">{building.name}<button title="Close" onClick={() => engine.select(null)}>×</button></div>
    <dl>
      <dt>Height</dt><dd>{building.h.toFixed(1)} m</dd>
      <dt>Footprint</dt><dd>{Math.round(area(building.g))} m²</dd>
      {zone && <><dt>Block</dt><dd>{zone.kind === 'block' ? `${zone.id}, ${zone.buildings.length} buildings` : 'outskirts'}</dd></>}
      <dt>OpenStreetMap</dt><dd><a href={`https://www.openstreetmap.org/way/${building.id}`} target="_blank" rel="noreferrer">way {building.id}</a></dd>
    </dl>
    <button className="card-action" onClick={() => engine.focusBuilding(building)}>Zoom to</button>
  </aside>;
}
