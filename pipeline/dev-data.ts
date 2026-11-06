import {spawnSync} from 'node:child_process';
import {changedInputs, onlyLiveModels} from './cache.ts';

const changed = changedInputs(process.cwd());
if (changed && onlyLiveModels(changed)) {
  if (changed.length) console.warn(`data: ${changed.length} building file(s) changed since the last build; starting without rebuilding. Run npm run data if ground patches or entrances changed.`);
} else {
  const {status} = spawnSync(process.execPath, ['--max-old-space-size=8192', 'pipeline/build.ts'], {stdio: 'inherit'});
  process.exitCode = status ?? 1;
}
