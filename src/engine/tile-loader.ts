import {fetchTile, type SurveyBucket, type SurveyManifest} from './data.ts';
import type {WorldFrame} from './types.ts';

export function tileLoader(survey: SurveyManifest, frame: WorldFrame, workerCount = 2, flat = false) {
  const pending = new Map<number, {resolve: (buckets: SurveyBucket[]) => void; reject: (error: Error) => void}>();
  const workers = Array.from({length: workerCount}, () => new Worker(new URL('./tile-worker.ts', import.meta.url), {type: 'module'}));
  let sequence = 0, failure: Error | undefined;
  for (const worker of workers) {
    worker.postMessage({type: 'init', survey, frame, flat});
    worker.onmessage = ({data}) => {
      const task = pending.get(data.id); pending.delete(data.id);
      if (data.error) task?.reject(Error(data.error)); else task?.resolve(data.buckets);
    };
    worker.onerror = event => { failure = Error(event.message); for (const task of pending.values()) task.reject(failure); pending.clear(); };
  }
  return {
    async load(root: string, name: string) {
      const buffer = await fetchTile(root, name);
      if (failure) throw failure;
      const id = sequence++;
      return new Promise<SurveyBucket[]>((resolve, reject) => {
        pending.set(id, {resolve, reject}); workers[id % workers.length].postMessage({type: 'decode', id, name, buffer}, [buffer]);
      });
    },
    dispose() { for (const worker of workers) worker.terminate(); for (const task of pending.values()) task.reject(Error('Tile loader closed')); pending.clear(); },
  };
}
