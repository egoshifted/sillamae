import {useSyncExternalStore} from 'react';
import {DebugPanel} from './DebugPanel.tsx';
import {ExplorePanel} from './ExplorePanel.tsx';
import {HoverLabel} from './HoverLabel.tsx';
import {Loading} from './Loading.tsx';
import {SearchPanel} from './SearchPanel.tsx';
import {town} from './town.ts';
import {useBuildingTaps} from './useBuildingTaps.ts';
import {useSpinKeys} from './useSpinKeys.ts';
import {useViewUrl} from './viewUrl.ts';

export function App() {
  const {engine, progress, error} = useSyncExternalStore(town.subscribe, town.get);
  useSpinKeys(engine);
  useViewUrl(engine);
  useBuildingTaps(engine);

  return <>
    <SearchPanel engine={engine}/>
    <ExplorePanel engine={engine}/>
    <footer><span>Geometry: Maa- ja Ruumiamet · Map: © OpenStreetMap contributors</span></footer>
    {!progress.viewReady && <Loading progress={progress}/>}
    {engine && <HoverLabel engine={engine}/>}
    {error && <div id="error">The town could not start: {error}</div>}
    {engine && <DebugPanel engine={engine} progress={progress}/>}
  </>;
}
