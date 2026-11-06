import type {Deck, Point2, Waterwork} from '../../engine/types.ts';

// Local metres and absolute heights, placed from the land board's orthophoto and read from its
// 2023 oblique photos. Dam dimensions are from the Sillamäe III permit draft. Heights above the
// water and the footbridge's pier spacing are judged from photos, not surveyed.
const along = ([ax, az]: Point2, [bx, bz]: Point2, t: number): Point2 => [ax + (bx - ax) * t, az + (bz - az) * t];

function footbridge(from: Point2, to: Point2) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), side: Point2 = [-(to[1] - from[1]) / length, (to[0] - from[0]) / length], works: Waterwork[] = [];
  const rail = (offset: number): Waterwork => ({from: [from[0] + side[0] * offset, from[1] + side[1] * offset], to: [to[0] + side[0] * offset, to[1] + side[1] * offset], width: .14, bottom: 12, top: 13, material: 'rail'});
  works.push({from, to, width: 3.2, bottom: 11.1, top: 11.85, material: 'concrete'}, rail(1.5), rail(-1.5));
  const piers = 8;
  for (let i = 1; i < piers; i++) {
    const [x, z] = along(from, to, i / piers);
    works.push({from: [x - side[0] * 1.3, z - side[1] * 1.3], to: [x + side[0] * 1.3, z + side[1] * 1.3], width: .9, bottom: 7.5, top: 11.1, material: 'dark'});
  }
  return works;
}

// Square to the dam: u runs along the road, the wall ring stands around a dark well of water.
function intakeBox([cx, cz]: Point2, [ux, uz]: Point2, length: number, depth: number, bottom: number, top: number) {
  const corner = (a: number, b: number): Point2 => [cx + ux * a * length / 2 - uz * b * depth / 2, cz + uz * a * length / 2 + ux * b * depth / 2];
  const [nw, ne, se, sw] = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  const wall = (from: Point2, to: Point2): Waterwork => ({from, to, width: .6, bottom, top, material: 'concrete'});
  return [wall(nw, ne), wall(ne, se), wall(se, sw), wall(sw, nw), {from: [(nw[0] + sw[0]) / 2, (nw[1] + sw[1]) / 2], to: [(ne[0] + se[0]) / 2, (ne[1] + se[1]) / 2], width: depth - .6, bottom, top: top - .5, material: 'dark'} as Waterwork];
}

const FOOTBRIDGE: [Point2, Point2] = [[-473, 125], [-570, 215]];

export const waterworks: Waterwork[] = [
  ...footbridge(...FOOTBRIDGE),
  // Sillamäe III, the highway dam: intake tower in the upper lake, flared outlet in the lower.
  {from: [-332.7, 587.3], to: [-321.6, 587.7], width: 7.8, bottom: 13.5, top: 20, material: 'concrete'},
  {from: [-333.1, 587.3], to: [-321.2, 587.7], width: 8.6, bottom: 20, top: 20.3, material: 'roof'},
  {from: [-327.3, 583.2], to: [-327.3, 576], width: 1.6, bottom: 16.9, top: 17.1, material: 'rail'},
  {from: [-332.2, 530.9], to: [-328.1, 550.6], width: .8, bottom: 7.5, top: 10, material: 'concrete'},
  {from: [-316.7, 531.7], to: [-321.6, 551], width: .8, bottom: 7.5, top: 10, material: 'concrete'},
  {from: [-328.5, 550.6], to: [-321.2, 551], width: 1, bottom: 7.5, top: 11.5, material: 'concrete'},
  // The Kesk dam: boxed intake on the lake side, headwall and foaming outflow on the pond side.
  ...intakeBox([-727.1, -285.9], [.92, .39], 8.6, 6, 7.6, 9.7),
  {from: [-725.3, -308.3], to: [-700.7, -297.9], width: .6, bottom: 4.8, top: 9.6, material: 'concrete'},
  {from: [-722, -312.2], to: [-706.6, -312.2], width: 13, bottom: 5.1, top: 5.2, material: 'foam'},
];

export const decks: Deck[] = [{from: FOOTBRIDGE[0], to: FOOTBRIDGE[1], half: 3, height: [11.95, 12]}];
