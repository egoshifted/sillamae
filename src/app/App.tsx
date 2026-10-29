import {useSyncExternalStore} from 'react';
import {BuildingCard} from './BuildingCard.tsx';
import {DebugPanel} from './DebugPanel.tsx';
import {ExplorePanel} from './ExplorePanel.tsx';
import {HoverLabel} from './HoverLabel.tsx';
import {SearchPanel} from './SearchPanel.tsx';
import {town} from './town.ts';
import {useSpinKeys} from './useSpinKeys.ts';
import {useViewUrl} from './viewUrl.ts';

export function App() {
  const {engine, progress, error} = useSyncExternalStore(town.subscribe, town.get);
  useSpinKeys(engine);
  useViewUrl(engine);

  return <>
    <SearchPanel engine={engine}/>
    <ExplorePanel engine={engine}/>
    <footer>Left-drag to move · Scroll to zoom · A D Rotate · W S Tilt <span>Geometry: Maa- ja Ruumiamet · Map: © OpenStreetMap contributors</span></footer>
    {!progress.viewReady && <div id="loading">Loading the town…{progress.total ? ` ${progress.loaded} / ${progress.total}` : ''}</div>}
    {engine && <HoverLabel engine={engine}/>}
    {engine && <BuildingCard engine={engine}/>}
    {error && <div id="error">The town could not start: {error}</div>}
    {engine && <DebugPanel engine={engine} progress={progress}/>}
  </>;
}
