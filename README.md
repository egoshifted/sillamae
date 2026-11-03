# Sillamäe · 3D Atlas

Explore a 3D model of Sillamäe, Estonia, built from survey geometry, terrain and OpenStreetMap data. Search for an address, drag to move, scroll to zoom and use the rotation buttons to see another side. Selected buildings have hand-built details based on reference imagery.

## Run locally

Install Node.js 24 or newer, then run:

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. The first run generates the town data and can take several minutes. Later runs reuse verified output when the inputs are unchanged. The viewer requires WebGL and DecompressionStream.

| Command | Purpose |
| --- | --- |
| `npm run studio` | Open the building studio and site editor. See the [studio guide](src/studio/README.md). |
| `npm run check` / `npm test` | Type-check the project or run the tests. |
| `npm run data` / `npm run data:rebuild` | Generate atlas data or force a fresh build. |
| `npm run osm` / `npm run dtm` | Refresh the OpenStreetMap or terrain inputs. |
| `npm run build` | Type-check, prepare the data and build the static site in `dist/`. |

## Project layout

- `data/source/` holds the survey, terrain, street data and saved site edits. `pipeline/` turns these into tiles and town data under `public/data/`. See the [road-building guide](pipeline/ROADS.md) for road geometry and terrain grading.
- `src/engine/` renders the atlas. `src/city/sillamae/` supplies town settings, refined buildings and street assets.
- `src/app/` contains the viewer controls. `src/studio/` contains the local editing tools.

## Publishing and credits

Choose **GitHub Actions** as the Pages source in repository settings. The [Pages workflow](.github/workflows/pages.yml) builds and deploys the atlas on pushes to `main`.

Survey geometry and vegetation are from Maa- ja Ruumiamet. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Rendering uses Three.js (MIT). This independent visualisation is for exploration, and detail varies by building.
