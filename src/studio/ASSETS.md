# Asset library: generating objects

How AI agents (Claude Code, Codex or any other) make reusable objects for the site editor: bins, benches, lamps, bus stops, signs, fences. Read [AGENTS.md](../../AGENTS.md) first. The code is the source of truth; this file records the contract and the workflow.

An agent only ever writes **drafts**. The owner approves a draft in the site editor, which moves it into the library. Never move a draft into the library yourself, and never edit a library asset to make it look like something else.

## Where things live

| Location | What |
| --- | --- |
| `src/city/sillamae/assets/<id>/asset.ts` | Approved library assets. The folder name is the asset id. |
| `src/city/sillamae/asset-drafts/<id>/asset.ts` | Drafts waiting for review, with their `request.md` and any `REVIEW.md`. |
| `src/city/sillamae/assets/palette.ts` | Shared materials and geometry helpers. Use these before making your own. |
| `src/city/sillamae/assets/library.ts` | The index the studio reads: every library and draft folder, validated. |
| `src/engine/types.ts` | `AssetDefinition` and `Placement`: the contract. |
| `data/source/placements/<site>.json` | What the owner placed in each studio square. Do not edit by hand. |
| [templates/asset-request.md](templates/asset-request.md) | The request the owner fills in. |

## Asset ids

- Lowercase words joined by hyphens, ending in a two-digit number: `bin-concrete-01`, `bus-shelter-02`. Category or object first, then the distinguishing word.
- The id is fixed in the request. Keep it through every attempt; a rejected draft is redone under the same id.
- Before using an id, check it is not taken in `assets/` or `asset-drafts/`. `npm run assets:check` fails on a duplicate.
- An approved id never changes and is never reused, even after the asset is retired.

## Variants, revisions and retiring

- **Variant**: same shape, different finish or a small option (colour, with or without a lid). Add it to `variants` of the existing asset rather than making a new asset. Before starting a request, look for an existing asset that a variant would cover and say so to the owner.
- **Revision**: a change that keeps the footprint, the contact point and the attachment keeps its id; every placement updates. Make it as a draft copy under the same id only if the owner asks; otherwise edit in place on a branch for review.
- **New id**: anything that would move or break existing placements (a different footprint, wall instead of ground). Set `retired: true` on the old asset only when the owner asks. Retired assets stay in the library: they are hidden from the palette but still drawn where placed.

## The contract

Each `asset.ts` exports `const asset: AssetDefinition`:

- `id`, `name`, `category` (`street furniture`, `lighting`, `signs`, `vegetation`, `play`, `fences`, `utilities`), `tags`.
- `attach`: `ground`, `wall` or `either`.
- `size`: the built bounding box in metres along x, y, z. The check builds every variant and compares.
- `triangles`: the near-detail budget. Street furniture 150-400, a shelter or kiosk up to 1500. Lower is better: a street may hold hundreds.
- `variants`: at least one; the first is the default.
- `build({variant, detail})`: returns a new `THREE.Object3D`.
  - **Origin**: on the ground, the centre of the base at y = 0. On a wall, the middle of the back at z = 0, with the object in front of it (+z). Wall assets have their origin where they touch the wall; the editor puts it at the point clicked.
  - **Facing**: the front faces +z (a bench's sitters, a sign's face, a lamp arm's reach).
  - **Units**: metres, real dimensions. Look them up; do not guess from photos alone.
  - `detail: 'far'` is a simpler version for distant views, never heavier than `near`. Drop small parts, use fewer segments, merge slats into one slab.
  - Use `assemble()` from `palette.ts`: it merges parts into one mesh per material. Use the shared `palette` materials; add a palette entry rather than a private material when a new finish is needed. Do not dispose palette materials.
  - Flat colours by default. Canvas textures only when a flat colour cannot read (lettering, a timetable), drawn small, and never downloaded images.
  - No randomness that changes between builds, no network access, no imports from `src/studio/` or `src/app/`.
  - Relative imports only as `./` (files in the same folder), `../../assets/` (`palette.ts`) and `../../../../engine/`. These resolve the same from `assets/<id>/` and `asset-drafts/<id>/`, so approval can move the folder unchanged. The check enforces it.

## Workflow

1. **Read the request** (`templates/asset-request.md`, filled in by the owner) and any photos. If the owner gave only a sentence, ask for what the template marks as needed before starting.
2. **Check the library** for an existing asset or variant that fits. Report near matches to the owner instead of silently making a duplicate.
3. **Research**: real dimensions and construction from the photos, Street View around Sillamäe, manufacturer sheets or standards. Note sources in the draft's `request.md`.
4. **Create** `src/city/sillamae/asset-drafts/<id>/` with `asset.ts` and the request saved as `request.md`. Follow the contract above and the code style in AGENTS.md (no narrating comments; comment only non-obvious reasons).
5. **Check**: `npm run assets:check` (or `-- --id <id>` while iterating) and `npm run check`. Fix every failure. The check covers the id, building every variant at both details, size against the declared size, budget, base or back on its contact plane, and saved placements.
6. **Hand over** to the owner: the id, what it is, variants, triangle counts, sources, and anything you were unsure of. The owner opens the site editor (`/src/studio/site/`), finds the draft under **Drafts**, previews it in a square, then approves or rejects it with notes.
7. **After a rejection**, read `asset-drafts/<id>/REVIEW.md`, fix, re-run the checks and hand over again. Keep the notes; append, never delete.

Commit drafts and approvals like any other change. Do not commit photos that are not yours to share; keep links in `request.md` instead.

## What makes a good asset here

- It matches Sillamäe: Soviet-era concrete and painted steel, later Estonian municipal furniture. Look at Street View of the town, not catalogue renders.
- It is legible from the atlas camera: a clear silhouette, slightly exaggerated thin parts rather than invisible ones (bars under 3 cm vanish).
- It is cheap: one mesh per material, few segments, no hidden faces inside.
