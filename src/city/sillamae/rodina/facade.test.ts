import assert from 'node:assert/strict';
import test from 'node:test';
import {accessDesign, wellArea} from './access.ts';
import {front, garden, facadeLayout} from './facade.ts';
import {dimensions, frontOpenings, gardenOpenings} from './plain-model.ts';
import {createRodina} from './model.ts';

type Bounds = number[][];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const span = (bounds: Bounds, axis: number) => [bounds[0][axis], bounds[1][axis]];

function parts(pattern: RegExp) {
  const model = createRodina({compact: true}), found = model.userData.audit.features.filter(f => pattern.test(f.name)).map(f => f.bounds!);
  model.userData.dispose();
  return found;
}

test('roof peak, gable and central openings share the facade centre line', () => {
  assert.equal(dimensions.main.ridgeU, 10.7, 'the old 11.3 ridge put the Kesk peak 0.6 m beside the door');
  assert.equal(dimensions.main.ridgeV, 10.825);
  for (const [layout, openings, face] of [[front, frontOpenings, 'NNE'], [garden, gardenOpenings, 'ESE']] as const) {
    assert.ok(near(openings.find(o => o.id === face + '-D2')!.x, layout.centre));
    assert.ok(near(openings.find(o => o.id === face + '-L2-C2')!.x, layout.centre));
  }
});

test('each layout mirrors about its own wall centre', () => {
  for (const width of [21.4, 21.65]) {
    const layout = facadeLayout(width);
    for (const list of [layout.bays, layout.piers, layout.rustication, layout.sideDoors, layout.pilasters.map(p => p.x).sort((a, b) => a - b)])
      assert.ok(near(list[0] + list.at(-1)!, width), 'outer pair must mirror');
  }
});

test('outer bay elements stay between the corner pier and the pilaster', () => {
  for (const [face, axis, layout] of [['NNE', 0, front], ['ESE', 2, garden]] as const) {
    const wall = layout.centre * 2, shafts = layout.pilasters.filter(p => p.x < layout.centre).map(p => p.x - p.width / 2);
    const clear = [layout.pierWidth, Math.min(...shafts)], found = parts(new RegExp(`^${face}-(outer-jamb|outer-head|outer-band|outer-frieze|blind-outer-sill)`));
    assert.ok(found.length > 20);
    for (const bounds of found) {
      const [a, b] = span(bounds, axis), mirrored = a > layout.centre ? [wall - b, wall - a] : [a, b];
      assert.ok(mirrored[0] >= clear[0] - 1e-3 && mirrored[1] <= clear[1] + 1e-3, `${face} part at ${a}..${b} leaves the bay ${clear}`);
    }
  }
});

test('west wing end has a real well: five openings, parapet and railing clear of the wall', () => {
  const backs = parts(/^base\/WELL-W\d-backing$/), well = accessDesign.wells[1];
  assert.equal(backs.length, 5, 'the old solid end wall had no basement windows');
  for (const bounds of backs) assert.ok(bounds[1][0] > -23.9 && bounds[0][0] > -23.92, 'glass sits behind the wall face');
  wellArea(well).forEach((value, i) => assert.ok(near(value, [-25.47, -23.92, 4.53, 16.83][i])));
  assert.ok(well.floor < -1.69, 'floor must stay below the lowest ground at the wall');
  for (const [name, north] of [['^base/west-well-solid-parapet', true], ['^base/west-well-guard-rail', false]] as const)
    for (const bounds of parts(new RegExp(name))) {
      assert.ok(bounds[1][0] <= -25.47 + 1e-3, name + ' stands at the outer edge of the well');
      assert.ok(north ? bounds[1][2] <= 8.2 + 1e-3 : bounds[0][2] >= 8.2, 'solid section stays at the north end');
    }
});

test('facade ornament stays shallow and on the wall', () => {
  // The sun runs nearly along these walls, so deep relief threw long smears across the gable.
  const proud = (pattern: RegExp) => Math.max(...parts(pattern).map(bounds => -bounds[0][2]));
  assert.ok(proud(/^NNE-arch-voussoir/) <= .07, 'old arch stones stood 16.5 cm proud');
  assert.ok(proud(/^NNE-(capital|gable-lyre|corner-mask|corner-wreath)/) <= .3);
  for (const bounds of parts(/^NNE-entry-roundel.*-plate$/)) assert.ok(-bounds[1][2] <= 0, 'old roundels floated 14.5 cm off the wall');
});

test('blind panel foot ornament sits on the wall above the plinth', () => {
  for (const bounds of parts(/^NNE-blind-base-garland/)) {
    assert.ok(bounds[0][1] > .69, 'the old garland hung into the plinth');
    assert.ok(bounds[1][1] < 1.3, 'ornament stays under the sill');
  }
});
