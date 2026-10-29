import {useEffect, useRef, useState} from 'react';
import {loadNav, type NavData} from '../engine/data.ts';
import type {Engine} from '../engine/engine.ts';
import type {Progress} from './town.ts';

const REFRESH_MS = 250;

export function DebugPanel({engine, progress}: {engine: Engine; progress: Progress}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [relief, setRelief] = useState(false);
  const nav = useRef<Promise<NavData> | null>(null);
  const latest = useRef(progress);
  latest.current = progress;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      e.preventDefault(); // otherwise the browser opens its help page
      setOpen(o => !o);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    if (!open) return;
    let last = engine.debugInfo(), lastAt = performance.now();
    const refresh = () => {
      const info = engine.debugInfo(), now = performance.now(), seconds = (now - lastAt) / 1000;
      const fps = (info.frames - last.frames) / seconds, rps = (info.renders - last.renders) / seconds;
      last = info;
      lastAt = now;
      const [x, y, z] = info.target, [east, north] = info.grid, n = (v: number, d = 1) => v.toFixed(d);
      setText([
        `loop ${n(fps, 0)} fps  draws ${n(rps, 0)}/s`,
        `render ${n(info.renderMs, 2)} ms (CPU)`,
        `calls ${info.draws}  tris ${(info.triangles / 1e6).toFixed(2)} M`,
        `${info.detail}  ${n(info.ppm, 2)} px/m  zoom ${n(info.zoom, 2)}`,
        `heading ${n(info.angles.heading)}°  elevation ${n(info.angles.elevation)}°`,
        `target ${n(x)} ${n(y)} ${n(z)}`,
        `L-EST97 E ${n(east, 0)} N ${n(north, 0)}`,
        `shadow ${info.shadow.mapSize}² r ${info.shadow.radius} m${info.shadow.detailed ? ' detail' : ''}`,
        `gpu geo ${info.geometries}  tex ${info.textures}  prog ${info.programs}`,
        `tiles ${latest.current.loaded}/${latest.current.total}  view ${n(latest.current.firstView / 1000, 2)} s  all ${n(latest.current.complete / 1000, 2)} s`,
      ].join('\n'));
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, engine]);

  const showNav = async (visible: boolean) => {
    try {
      engine.showNav(await (nav.current ??= loadNav('./data/')), visible);
    } catch (error) {
      console.error(error);
      nav.current = null;
    }
  };
  return <aside id="debug" hidden={!open}>
    <div className="debug-title">Debug <span>F1</span></div>
    <pre>{text}</pre>
    <label><input id="textures" type="checkbox" defaultChecked onChange={e => engine.setTextures(e.target.checked)}/> Textures</label>
    <label><input id="shadows" type="checkbox" defaultChecked onChange={e => engine.setShadows(e.target.checked)}/> Shadows</label>
    <label><input type="checkbox" data-option="trees" defaultChecked onChange={e => engine.showTrees(e.target.checked)}/> Trees</label>
    <label><input type="checkbox" data-option="continuous" onChange={e => engine.continuous = e.target.checked}/> Draw every frame</label>
    <label><input type="checkbox" data-option="nav" onChange={e => showNav(e.target.checked)}/> Walking network</label>
    <label><input type="checkbox" data-option="zones" onChange={e => engine.showZones(e.target.checked)}/> Blocks</label>
    <label><input type="checkbox" data-option="relief" onChange={e => { engine.showRelief(e.target.checked); setRelief(e.target.checked); }}/> Relief</label>
    {relief && <div className="debug-legend">
      <span>{engine.reliefRange[0].toFixed(0)} m</span><i/><span>{engine.reliefRange[1].toFixed(0)} m</span>
      <small>contours 2 m, bold 10 m</small>
    </div>}
  </aside>;
}
