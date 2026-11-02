import test from 'node:test';
import assert from 'node:assert/strict';
import {AtlasBuildQueue} from './atlas-build.ts';
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
test('saves during a build queue the latest snapshot, without overlapping builds', async () => {
  const first = deferred(), second = deferred();
  let calls = 0;
  const queue = new AtlasBuildQueue(() => ++calls === 1 ? first.promise : second.promise);
  queue.request(); queue.request(); queue.request();
  assert.equal(calls, 1);
  first.resolve(); await tick();
  assert.equal(calls, 2);
  assert.equal(queue.status().state, 'building');
  second.resolve(); await tick();
  assert.deepEqual(queue.status(), {state: 'ready', requested: 3, completed: 3});
});
test('an invalidated build retries the newer save instead of reporting success or failure early', async () => {
  const first = deferred(); let calls = 0;
  const queue = new AtlasBuildQueue(() => ++calls === 1 ? first.promise : Promise.resolve());
  queue.request(); queue.request();
  first.reject(Error('Inputs changed')); await tick();
  assert.equal(calls, 2);
  assert.equal(queue.status().state, 'ready');
  assert.equal(queue.status().completed, 2);
});
test('failed builds remain failed until a subsequent save successfully retries', async () => {
  let fail = true;
  const queue = new AtlasBuildQueue(async () => { if (fail) throw Error('Disk full'); });
  queue.request(); await tick();
  assert.equal(queue.status().state, 'error');
  assert.equal(queue.status().completed, 0);
  assert.equal(queue.status().error, 'Disk full');
  fail = false; queue.request(); await tick();
  assert.deepEqual(queue.status(), {state: 'ready', requested: 2, completed: 2});
});
