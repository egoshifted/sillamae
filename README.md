# Sillamäe · 3D Atlas

An interactive 3D model of Sillamäe, Estonia. The town model is being progressively refined against reference imagery; detail varies between buildings.

Search for an address, drag to move, scroll to zoom, and use the rotation buttons to view another side. Adjust sunlight, textures, shadows and rendering quality with the on-screen controls.

## Develop

Requires Node.js 22 or newer.

```
npm install
npm run dev      # build data, then a local server with reload
npm run build    # type check, build data, static site in dist/
npm run data     # data only
npm run osm      # refresh data/source/osm.json from OpenStreetMap
npm run dtm      # refresh data/source/dtm-1m.* from the Maa- ja Ruumiamet terrain model
```

Source data lives in `data/source/`. `pipeline/build.ts` prepares it into `public/data/` (not committed): it cuts refined buildings out of the survey mesh, classifies and buckets the survey triangles, and packs them into 360 m tiles (vertices on a 1 mm grid, meshopt-encoded, then gzip) that the viewer decodes without further processing. The viewer streams the tiles: those around the first view on their own, then the rest nearest-first.

The build also georeferences the survey by matching building outlines with OpenStreetMap (EPSG:3301, about 0.1 m RMS) and writes `nav.json`: the walking network in scene coordinates, with every building linked to it through its entrances. Entrances come from refined models, from OpenStreetMap `entrance` nodes, or are estimated as the outline point facing the nearest path.

The survey ground is laid onto the 1 m terrain model of Maa- ja Ruumiamet (`data/source/dtm-1m.*`, heights in centimetres): every ground vertex moves by the difference between that model and the lowest survey ground layer, so the stacked ground layers keep their gaps, and edges along which the terrain bends are subdivided. Water, ground under water and the Kesk 1 site keep their heights; trees stand on the new ground.

Every OpenStreetMap `steps` way becomes stairs: one flight per segment with treads, a solid base and side cheeks, its ends on the 1 m terrain model; width and step count come from OSM tags where mapped (2 of 56 ways), otherwise 2.5 m and 15 cm risers.

Buildings are grouped into blocks: areas enclosed by streets and the edge of the modelled town, found by flood-filling a 2 m street raster. Each building in `world.json` carries its block (`zone`); the F1 debug panel can colour buildings by block.

Code layout:

- `src/engine/`: the renderer. It knows nothing about a particular town.
- `src/city/sillamae/`: town settings and refined building models (Kesk 1).
- `src/app/`: the on-screen controls, in React. The engine is created once outside React's render cycle; components use its API.

The build uses relative URLs, so `dist/` works under a repository subdirectory. It needs a modern browser supporting WebGL and DecompressionStream.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` builds and deploys `dist/` on every push to `main`. In Settings → Pages, set Source to GitHub Actions.

## Credits

Map data: © OpenStreetMap contributors — https://www.openstreetmap.org/copyright

Survey geometry and vegetation: Maa- ja Ruumiamet.

Rendering: Three.js (MIT).

This is an independent visualisation, not an official survey or navigation service.
