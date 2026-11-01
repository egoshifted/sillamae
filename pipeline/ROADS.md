# Roads: method for extending the pilot

How the road layer is built and how to carry it to another block. Read [AGENTS.md](../AGENTS.md) first. The code is the source of truth; this file records the method and the lessons that shaped it.

## How it works

1. **Network** (`pipeline/roads.ts`, `buildRoads`). OSM ways near the road area go to [osm2streets](https://github.com/a-b-street/osm2streets) (`osm2streets-js` 0.1.4, WebAssembly, run in the data build). It returns lane, junction and lane-marking polygons in lon/lat; they are converted to the local frame with the georeference.
   - Steps are left out (they are built as stairs).
   - Crossing ways (`footway=crossing`) are left out: this version turns them into footway lanes lying across the carriageway. Marked crossings are drawn as zebras instead: 0.5 m bars at 1 m pitch along a straight line from the crossing's first to last point, clipped to the carriageway. Lane lines are cut back 1 m from each zebra.
   - Inferred sidewalks are off; separately mapped sidewalks and paths become footways, clipped off the carriageway.
2. **Width.** This osm2streets version ignores width tags (driving lanes are always 3 m), so each street is sized to the survey's own road paint: every 4 m along its OSM ways, away from their ends, the build scans across the top survey layers for road or marking colour and takes the median width. Wider streets are offset outward; narrower ones are cut to a band around their OSM line (shrinking the outline would also pull the ends back from the junctions). Junctions take the largest change of the streets meeting there.
3. **Survey footway paint** (`clearFootwayPaint`). The survey's footway paint does not match the ground (a wide pale band along the roads where Street View shows a small kerb and grass), so inside the road area every survey triangle in footway colour takes the median colour of the ground around it; mapped footways are drawn over it. Triangles crossing the area's edge are split along it in their own plane and only the inside part is recoloured. Heights, layers and the survey's triangle order are unchanged.
4. **Grading** (`pipeline/grade.ts`). The terrain model is graded to the roads before the survey ground is laid on it: each road's terrain profile is smoothed along it (±12 m), held flat across its width and blended back over 3 m. Overlapping corridors are averaged by weight, so junctions have no steps. The graded `HeightAt` feeds the drape, trees, stairs and building settling.
5. **Laying** (`layRoads`). After the drape:
   - Roads stop at the ground patches of refined sites (`prepareSurvey` returns them); refined building models must not build streets.
   - Carriageways and footways are cut into 3 m cells and densified every 2 m. Each ring point takes the top draped ground surface within 2 m, plus 2 cm.
   - Each surface gets a depth lift: 0.3 m per survey layer beneath it (the survey shader's step) plus 0.5 m. A carriageway takes any touching footway's lift plus 2 cm, so it always wins at their shared edge.
   - Markings are laid on the carriageway's own triangles (shared `triangulate`), 3 cm above it, with the highest lift of any carriageway they overlap plus 5 cm.
6. **Viewer** (`src/engine/roads.ts`). One mesh per kind; the per-vertex `lift` attribute moves depth only. Roads receive shadows but do not cast them.

The survey ground is never cut under roads: it stays as it is beneath them, so a road can never open a see-through hole.

## Extending to another block

1. Branch from `main`. Record atlas view URLs of the block (top-down and a low oblique per junction and crossing) and look at Street View for each street: real carriageway width, crossings, what lies beside the road (grass or sidewalk), parking.
2. Inspect the OSM ways in the block (`data/source/osm.json`): highway types, `lanes`, `sidewalk*`, crossing tags (`crossing`, `crossing:markings`), areas mapped as ways. Note refined sites nearby and check their models build no streets of their own (Kesk 1 did; it was removed).
3. Move or enlarge the road area (`PILOT` in `pipeline/roads.ts`). Keep junctions well inside it: osm2streets cuts roads at the clip edge and the survey road carries on beyond it.
4. `npm run data` and read the `roads` report line: polygon counts, zebra crossings, how many carriageways were widened, narrowed or left unmeasured. An unmeasured street keeps 3 m lanes; find out why (no paint, short way, paint covered by trees). The next line counts recoloured footway paint; a sidewalk or path seen in Street View that turned to grass is missing from OSM, so report it.
5. `npm run roads:check` and fix until it passes, then review the rest:
   - broken polygons and footways on the carriageway must be 0 (the command fails otherwise);
   - each marked crossing's carriageway span should match the paint span within 0.5 m;
   - uncovered survey road paint shows as a second road; review the largest cells. Parking, driveways and unmapped service areas legitimately stay uncovered.
6. Look in the atlas: full reload after every data build. Check from above and low down, at junction mouths, crossings, the area's edge and next to refined sites.
7. `npm run check`, `npm test`, `npm run build`. Commit without `public/data`.

Do not hand-place road geometry in building models, edit `osm.json` by hand (it is refetched) or cut the survey ground. Report OSM data errors to the owner instead.

## Symptoms and causes

| Seen in the atlas | Cause | Remedy in the method |
| --- | --- | --- |
| Blue see-through lines along roads | Survey ground cut under the road, and the road did not reach the ground beside it | Never cut; overlay with a depth lift |
| Raised slab with ends near a building | A refined model drew its own street over the generated one | Models build no streets; roads stop at site patches |
| Pale strips across the road at crossings and junctions | Crossing and sidewalk ways given to osm2streets became footway lanes on the carriageway | Leave crossings out, draw zebras; clip footways off the carriageway |
| Pale strip across a street at its junction | A narrowed street's outline shrank at its ends too | Narrow across only, to a band around the OSM line |
| Strips of a second road along both edges, zebra ends sticking out | The survey's own road is wider than osm2streets' 3 m lanes | Size each street to the survey paint |
| Markings dark, or the road darker than expected | Survey layers above the road shadow it | Lay roads on the top survey surface, not the lowest |
| Bars or dashes with their own shadow | The middle of a wide polygon dipped below survey paint sheets between its edge points | Cut surfaces into cells so ring points stay within reach |
| Zebra bars cut off along diagonal lines | Markings sampled from the ground sank into the carriageway's interpolated triangles | Lay markings on the carriageway triangles |
| Doubled, skewed zebra bars | A bent crossing way laid bars per segment | Lay the zebra along a straight first-to-last line |
| A bar doubled by a centre-line dash | Lane line running through the zebra | Cut lane lines back from zebras |
| Wide pale "marble" band beside the road where Street View shows a small kerb and grass | Survey footway paint spreads about 1 m past the road paint | Recolour survey footway paint to the ground around it |
| Footways and zebras inside a block ringed by road vanish | A dropped hole in a carriageway union used for cutting | Use `area` (keeps holes) for anything used to cut |
| Thick dark band behind a raised edge (seen with trial kerbs) | Geometry below the verge, drawn over the grass in front by the depth lift | Never extend lifted geometry below the ground beside it |

## Working notes

- Vite on a OneDrive checkout can miss a file change; if the browser runs stale code, touch the file. After `npm run data` reload the page fully: a hash change does not reload data.
- Survey colours for road, footway and marking paint are in `pipeline/survey-colour.ts`; a layer within 3 cm of the top one is what is seen.
- Clipper works in integer millimetres and the viewer cannot draw holes, so drawn clip results keep outer contours only; cutting operands keep their holes (`area`).
- Hash changes alone do not always move the atlas camera; set the hash and reload.
- Open: kerbs are not modelled (a trial was removed); driving lanes keep osm2streets' layout inside the new width; white edge lines and double centre lines are not drawn.
