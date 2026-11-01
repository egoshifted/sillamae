# Building studio

A reusable local workspace for progressively building and refining any atlas building. Start with [a new building](NEW-BUILDING.md); no existing refined model is required. Read [AGENTS.md](../../AGENTS.md), then [the process](PROCESS.md), [refinement rules](REFINEMENT-RULES.md) and [the component checklist](COMPONENTS.md). Update the relevant rule when a correction teaches a general lesson; keep building decisions and evidence in local records.

Copy the [collaborator prompt](COLLABORATOR-PROMPT.md) to start an agent on any building. Reference study requires both available Street View and web searches for photographs; ask the user for specific missing photos when these sources leave gaps.

## Reuse before creating new assets

Follow [the reuse guide](REUSE.md) before authoring textures, details, fittings, fixtures or other components. Search existing assets and rendered parts for exact and near-identical matches; prefer supported reuse and report sources, adaptations, visible differences, resource effects and owner choices in every refinement review. Near matches remain explicit choices for the owner, not silent substitutions. The local record and review templates include this inventory. Preserve target-specific dimensions and layouts, shared-resource lifetimes and existing consumers.

## Start

Requires Node 24+ and the repository's installed dependencies:

```sh
npm ci
npm run studio
```

Open `http://127.0.0.1:5174/src/studio/`. The same server serves the atlas at `/`. An existing atlas development server also serves `/src/studio/`; do not start another server unnecessarily. Studio is a development entry point and is excluded from the published application build.

Search the catalogue by address or stable ID and select any building. Orbit, pan, choose eight repeatable 45° views, inspect the plan and compare close/medium/far views. Check morning/midday/late light, shadows, textures and plain materials. **Save view URL** records the camera and switches in the address bar. Copy that URL into your local record. **Download PNG** saves to your browser's local downloads folder; move it into the building's local evidence folder.

Every catalogue building has original-survey and provisional-massing views. New draft stages are discovered from `src/city/sillamae/*/study.ts`; existing refined buildings provide optional examples. Plain materials do not simplify the shell or certify material appearance. Assembled mode calls the same `BuildingOverride` used by the atlas. Studio uses diagnostic lighting and untextured local site triangles, without vegetation or atlas depth layering. It removes the atlas-only projected ground-depth offsets from the study material shaders; these orthographic offsets would otherwise draw hidden stairs through walls and roofs in the perspective study camera. A small polygon offset keeps coplanar ground contacts stable without the metre-scale displacement. Original survey is ungraded; a draft may be based on a prepared height envelope. Always finish datum, ground-contact, lighting, vegetation and loading checks in the atlas.

## Site editor

`/src/studio/site/` opens a square of the atlas (50, 100 or 200 m) for adding street detail from the asset library. Choose the square on the map. The palette on the left sets the brush (an asset, or a broadleaf or conifer tree); the toolbar on the canvas holds the tools, each with its options in the top bar and its keys in the footer:

| Tool | Key | Use |
| --- | --- | --- |
| Select and move | V | Click, Shift-click, Ctrl-click or drag a box to select objects and trees, survey trees included. Drag to move; drag the orange ring to turn the selection round its centre (15° steps, Alt for free); Q/E turn 15° (Shift 90°); arrows nudge 10 cm (Shift 1 m); Del, Ctrl+D, Ctrl+A. |
| Place | A | Click the ground or a wall; Alt-click an object to pick up its asset. |
| Path | P | Click points; double-click or Enter places a row at the set spacing, facing along or across the path, with a sideways offset. |
| Scatter | B | Drag to scatter the brush within a radius, keeping a gap from its own kind. |
| Measure | I | Click points for lengths on plan, height changes and slopes. |
| Orbit, Pan | R, H | Navigation; in any tool Space or the middle button orbits, right-drag pans, the wheel zooms to the pointer. F frames the selection, T looks straight down, Home resets. |

Ground assets stand on the highest ground or road surface and never inside a building footprint; wall assets sit flat against the wall facing out. Ctrl+Z/Ctrl+Y undo and redo, Ctrl+S saves to `data/source/placements/<x>_<z>_<size>.json`. A changed survey tree is saved as removed at its old position and added anew, matched within 0.75 m so the edit survives a data rebuild that nudges trees. Drafts appear under **Drafts to review** for previewing in place; **Approve** moves a draft into the library, **Reject** writes notes for the agent. `npm run data` brings saved squares into the atlas: tree edits are applied before trees are seated on the ground, and placements of library assets (never drafts) go to `public/data/placements.json`, drawn in batches per 120 m with the far detail and small objects hidden when zoomed out. The build reports placements standing more than 0.5 m from the terrain; `npm run assets:check` also checks placements against the built buildings and roads. Generating assets is described in [ASSETS.md](ASSETS.md); `npm run assets:check` validates the library, drafts and saved placements.

## What lives where

| Location | Responsibility |
| --- | --- |
| `src/city/sillamae/<building>/` | Production model, design, building-specific assets and site adaptation for that address; reference canonical shared assets instead of copying them. |
| `src/studio/project.ts`, `studies.ts`, `types.ts` | Select the city, discover per-building stages and apply a common study lifecycle. Building-specific stages live beside their model. |
| `src/studio/viewer.ts` | Shared controls, camera, lighting and lifecycle for every building. |
| `src/studio/assembly/` | Shared model-authoring utilities and extracted city-independent components used by studies and production models. No UI, evidence or town assumptions. |
| `src/city/sillamae/shared/` (when needed) | Town-specific shared assets/loaders or component variants extracted under the reuse guide; existing canonical assets may remain in building folders. |
| `src/studio/tools/` | Portable TypeScript versions of the local verification, model snapshot and capture workflows. |
| `src/engine/` | Town-independent runtime and survey handling; never import studio UI/tools here. |
| Local folder outside the checkout | Photos, URLs, feature schedules, approvals, backups, comparisons, captures, logs and reports. |

No copied model/vendor tree, personal filesystem paths, historical approval records or private reference images are needed to run studio. Production imports only the small batching utility, not the viewer or review tooling. See [assembly](ASSEMBLY.md) before extending a generator.

## Local checks

Use a new output directory for every run. These commands reject repository-contained outputs (including junction aliases) and never replace an existing record. Paths below are examples **outside** the checkout; choose your own local review root.

```sh
npm run check
npm run build
npm run studio:check -- --out ../sillamae-local/review-001/checks
npm run studio:snapshot -- --out ../sillamae-local/review-001/models
```

`studio:check` runs type checking, batching/output-safety tests, data generation and the production build. Exit **1** means failure; **2** means automated checks passed and visual review remains pending. Normal `check` and `build` retain their usual exit codes. Snapshot checks finite attributes/transforms, texture restoration, LOD snapshots and scene cleanup; it uses inert Node canvases, so browser material checks are still required. Compare snapshots with `--compare <previous-model-directory>` for a rendering-neutral change.

Install a local browser once with `npx playwright install chromium`, or set `STUDIO_BROWSER` to your existing Chrome/Chromium executable (PowerShell: `$env:STUDIO_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'`). Captures never contact a remote atlas.

```sh
npm run studio:capture -- --url http://127.0.0.1:5174 --id <building-id> --stage draft --out ../sillamae-local/review-001/views
npm run studio:capture -- --url http://127.0.0.1:5174 --atlas-only --out ../sillamae-local/refactor-before
# After the change, on the same browser, machine and viewport:
npm run studio:capture -- --url http://127.0.0.1:5174 --atlas-only --out ../sillamae-local/refactor-after --compare ../sillamae-local/refactor-before
```

The capture runner saves unobscured canvas PNGs, decoded RGBA hashes, source hashes and browser errors. Comparisons require identical capture names and pixels; any mismatch exits 1. Review intentional differences individually, retaining the original baseline. Capture success means pictures were taken, not inspected. Run capture after checks; avoid editing sources during either run. For active building corrections inspect that building; the registered-building atlas preservation views are technical parity checks and do not reopen older architectural approvals.

Copy [the review template](templates/visual-review.json) into your local folder. Fill findings after inspecting the images. Add close detail/reference PNGs and WebM/MP4 motion evidence as needed; the automated overview matrix is not a substitute. To bind additional PNGs to a run, use `studio:evidence` before filling the review. It creates a separate capture record rather than editing the old one. The reviewer must record when and under which conditions the manual evidence was captured.

```sh
npm run studio:evidence -- --captures ../sillamae-local/review-001/views --extra ../sillamae-local/review-001/manual --out ../sillamae-local/review-001/all-views
npm run studio:finalize -- --checks ../sillamae-local/review-001/checks --captures ../sillamae-local/review-001/all-views --review ../sillamae-local/review-001/visual-review.json --out ../sillamae-local/review-001/final
```

Finalization checks evidence files, unchanged source/data hashes, automated results and explicit findings. It does not interpret photos, prove motion from a still, or grant architectural approval. Leave an uninspected gate pending; mark an inapplicable gate with a specific reason. List known failures explicitly in the review; finalization rejects unresolved failures. Save exact owner approvals separately using [the building record](templates/building-record.md).

## Provenance and cleanup

The process and rules were consolidated from the existing building-refinement rules (including the 24–28 October lessons), the 12-stage process and D01–D20 component checklists used for Kesk 1, Kesk 5 and Rodina. The study controls derive from the Rodina study viewer; verification derives from the local TypeScript migration and apron investigations. Historical commands under `work/city3d`, vendored Three.js, hardcoded paths, duplicated model copies and stale status claims are replaced by current imports and the commands above. Historical evidence stays local and immutable. Do not import archived runtime files over current city models.
