import test from 'node:test';
import assert from 'node:assert/strict';
import {flattenRows, revealRow, ROW_PITCH, rowWindow} from './rows.ts';

const leaf = (key: string) => ({key, children: [] as Node[]});
interface Node {key: string; children: Node[]}

test('only opened branches join the list, with their depth and place among siblings', () => {
  const tree: Node[] = [{key: 'a', children: [leaf('a/0'), leaf('a/1')]}, {key: 'b', children: [leaf('b/0')]}];
  const rows = flattenRows(tree, key => key === 'a');
  assert.deepEqual(rows.map(row => [row.node.key, row.depth, row.position, row.siblings]), [['a', 0, 1, 2], ['a/0', 1, 1, 2], ['a/1', 1, 2, 2], ['b', 0, 2, 2]]);
});

test('the window covers the viewport for any list size and stays within the list', () => {
  assert.deepEqual(rowWindow(0, ROW_PITCH * 20, 8000), [0, 30]);
  assert.deepEqual(rowWindow(ROW_PITCH * 100, ROW_PITCH * 20, 8000), [90, 130]);
  assert.deepEqual(rowWindow(ROW_PITCH * 7990, ROW_PITCH * 20, 8000), [7980, 8000]);
  assert.deepEqual(rowWindow(0, 600, 3), [0, 3]);
  assert.deepEqual(rowWindow(0, 0, 0), [0, 0]);
});

test('revealing a row scrolls only as far as it needs to', () => {
  const height = ROW_PITCH * 10, scrollTop = ROW_PITCH * 50;
  assert.equal(revealRow(scrollTop, height, 55), scrollTop);
  assert.equal(revealRow(scrollTop, height, 10), ROW_PITCH * 10);
  assert.equal(revealRow(scrollTop, height, 100), ROW_PITCH * 91);
});
