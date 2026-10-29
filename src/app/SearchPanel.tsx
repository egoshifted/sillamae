import {useEffect, useState} from 'react';
import type {Engine} from '../engine/engine.ts';

const MAX_RESULTS = 12;

export function SearchPanel({engine}: {engine: Engine | null}) {
  const [text, setText] = useState(''), [open, setOpen] = useState(false);
  useEffect(() => {
    if (engine) setText(engine.buildings.find(b => b.id === engine.focusedId)?.name ?? '');
  }, [engine]);

  const query = text.toLocaleLowerCase().trim();
  const matches = engine && open && query ? engine.buildings.filter(b => b.name.toLocaleLowerCase().includes(query)).slice(0, MAX_RESULTS) : [];
  return <section className="search-panel">
    <label htmlFor="search">FIND A BUILDING</label>
    <input id="search" placeholder="Try Kajaka 8 or Kesk…" autoComplete="off" value={text}
      onChange={e => { setText(e.target.value); setOpen(true); }}/>
    <div id="results" hidden={!open || !query}>
      {matches.map(b => <button key={b.id} onClick={() => { engine!.focusBuilding(b); setText(b.name); setOpen(false); }}>{b.name}</button>)}
    </div>
  </section>;
}
