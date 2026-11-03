import test from 'node:test';
import assert from 'node:assert/strict';
import {AtlasBuildQueue} from './atlas-build.ts';
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
test('saves never start builds, including saves during an explicit update', async () => {
  const first = deferred();
  let calls = 0;
  const queue = new AtlasBuildQueue(() => ++calls === 1 ? first.promise : Promise.resolve());
  queue.saved();
  assert.equal(queue.status().state, 'pending');
  assert.equal(calls, 0);
  queue.request(); queue.request(); queue.saved();
  first.resolve(); await tick();
  assert.equal(calls, 1);
  assert.equal(queue.status().state, 'pending');
  queue.request(); await tick();
  assert.equal(calls, 2);
  assert.equal(queue.status().state, 'ready');
});
test('failed updates can be retried explicitly', async () => {
  let fail = true;
  const queue = new AtlasBuildQueue(async () => { if (fail) throw Error('Disk full'); });
  queue.request(); await tick();
  assert.deepEqual(queue.status(), {state: 'error', error: 'Disk full'});
  fail = false; queue.request(); await tick();
  assert.equal(queue.status().state, 'ready');
});
