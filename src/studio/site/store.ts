import type {PlacementSite, Point2} from '../../engine/types.ts';

// The site store holds the whole town; the editor works on the items in the area
// it has open and merges them back on save, keeping everything else as it was.
type Inside = (x: number, z: number) => boolean;
const KINDS = ['placements', 'surfaces', 'lines', 'roads', 'roadCuts'] as const;
type Kind = typeof KINDS[number];
type Item = {id?: string; ring?: Point2[]};
const keyOf = (i: Item) => i.id ?? JSON.stringify(i.ring);

// What belongs to the open area: objects and trees standing in it, and drawn items
// with any point in it, so a road that crosses its edge can still be edited.
export function takeArea(town: PlacementSite, inside: Inside, buildingInside: (id: string) => boolean): PlacementSite {
  const any = (points: Point2[]) => points.some(([x, z]) => inside(x, z));
  return structuredClone({
    version: 3,
    placements: town.placements.filter(p => inside(p.p[0], p.p[1])),
    trees: {remove: (town.trees?.remove ?? []).filter(([x, z]) => inside(x, z)), add: (town.trees?.add ?? []).filter(t => inside(...t.p))},
    surfaces: (town.surfaces ?? []).filter(s => any(s.ring)),
    lines: (town.lines ?? []).filter(l => any(l.points)),
    roads: (town.roads ?? []).filter(r => any(r.points)),
    roadCuts: (town.roadCuts ?? []).filter(c => any(c.ring)),
    hidden: (town.hidden ?? []).filter(buildingInside),
  });
}

// The town with the area's items as edited: changed ones stay where they were in
// the store, removed ones go, new ones follow the rest.
export function mergeArea(town: PlacementSite, opened: PlacementSite, edited: PlacementSite): PlacementSite {
  const out: PlacementSite = {version: 3, placements: []};
  for (const kind of KINDS) {
    const items = merge<Item>(town[kind] ?? [], opened[kind] ?? [], edited[kind] ?? [], keyOf);
    if (items.length || kind === 'placements') (out as Record<Kind, unknown>)[kind] = items;
  }
  const trees = {
    remove: merge(town.trees?.remove ?? [], opened.trees?.remove ?? [], edited.trees?.remove ?? [], p => p.join(',')),
    add: merge(town.trees?.add ?? [], opened.trees?.add ?? [], edited.trees?.add ?? [], t => t.id),
  };
  if (trees.remove.length || trees.add.length) out.trees = trees;
  const hidden = merge(town.hidden ?? [], opened.hidden ?? [], edited.hidden ?? [], id => id);
  if (hidden.length) out.hidden = hidden;
  return canonical(out);
}

// One key order for the store file, so saving unchanged work rewrites nothing and queues no rebuild.
export function canonical(site: PlacementSite): PlacementSite {
  const order = ['version', 'placements', 'trees', 'surfaces', 'lines', 'roads', 'roadCuts', 'hidden'] as const;
  return Object.fromEntries(order.filter(k => site[k] !== undefined).map(k => [k, site[k]])) as unknown as PlacementSite;
}

function merge<T>(town: T[], opened: T[], edited: T[], key: (item: T) => string) {
  const before = new Set(opened.map(key)), now = new Map(edited.map(i => [key(i), i])), known = new Set(town.map(key));
  return [...town.flatMap(i => !before.has(key(i)) ? [i] : now.has(key(i)) ? [now.get(key(i))!] : []), ...[...now.values()].filter(i => !known.has(key(i)))];
}
