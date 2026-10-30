# Building assembly

## Runtime and pipeline contract

1. `src/city/sillamae/index.ts` registers stable OSM IDs through `CityDefinition`. Each adapter implements `BuildingOverride` from `src/engine/types.ts`.
2. `pipeline/build.ts` reads committed survey/OSM/DTM data. `prepareSurvey` calls each override's `carveSurvey` before preparing ground and streamed tiles. Plan corrections must happen here as well as in the model; do not correct only the visible shell.
3. The pipeline invokes the same generators to obtain ground patches. Node uses inert canvases; geometry must not depend on browser texture loading. Never replace source inputs with prepared data.
4. `src/app/town.ts` loads `world.json` and tile manifests, creates the engine once outside React, starts surface preloads and calls `addRefinedBuildings`. Near tiles load first, the remainder follow. Studio does not change this path.
5. An override receives scene, building, terrain, local frame and site ground. It returns root, ground patches, texture control and optional readiness. `root.userData.dispose` is the existing lifecycle convention. Keep asynchronous detail cancellation and texture failure fallback intact.

Source coordinates are metres `(x,z,height)`. Viewer coordinates are `(x-origin[0], height-base, z-origin[1])`. A building-local coordinate system may additionally rotate and use its own vertical datum. Record these separately. Do not treat screen height or a shader depth offset as physical elevation.

## Progressive study contract

Start with [NEW-BUILDING.md](NEW-BUILDING.md). `project.ts` selects the town and discovers building `study.ts` modules. Each `StudyDefinition` declares its stable ID and named stage factories. Every factory receives `OverrideContext` and returns `StudyModel`: root, cleanup, optional texture control and readiness. Survey and provisional massing are available before a model exists. Draft stages can progress through plain shell, access and detail; production registration remains separate. The viewer does not encode an architectural family or a fixed set of building IDs.

The starter massing utility accepts a footprint, datum and height. It deliberately supplies no guessed windows, balconies or roof style. Extend the active building’s generator from reference evidence. Existing implementations are described in [EXAMPLES.md](EXAMPLES.md) only as optional code references.

## Reusable assets and components

Follow [REUSE.md](REUSE.md) before creating textures, details, fittings, fixtures or components. Inspect existing candidates, prefer supported exact/near matches and report reuse, differences, new assets and owner choices in every refinement review. Keep canonical asset references rather than duplicate files; parameterise target-specific settings without inheriting another building's architecture. The guide lists current source locations, future extraction destinations, shared-resource ownership and consumer-preservation requirements. A source-file reuse is distinct from shared runtime allocations; record actual resource effects and uncertainty.

## Add or refine a building

Keep source in a city building directory; define stable identity, measured footprint, floor numbering, datum, entrances and reference-derived schedules. Start a plain study, then expose a `BuildingOverride` and register it with the city. Add a study adapter only when a plain/compact representation needs placement beyond the common assembled path. Test source-to-prepared ground parity after changing the footprint, grading, entrances or patches.

Keep deterministic feature order and stable materials. Batch only compatible meshes, preserving attribute values, transforms, winding, material/texture ownership and shadows. The shared batcher accepts visible direct child meshes with one standard material and position/normal/UV attributes. It rejects unsupported input rather than silently losing data. Do not feed picking attributes, material arrays, nested transforms or special draw ranges through it without explicitly extending the contract and tests.

Textures may be shared; materials should remain independent when their finish/toggle state differs. Restore texture maps exactly after disabling them. Dispose model-owned geometry/materials once, retain shared textures still in use, and make cancellation safe before deferred work finishes. Verify unloading and recreating a study repeatedly.

## Terrain and depth

Survey vertices contain seven floats: x, z, height, r, g, b, pick. Preserve stacked-layer gaps during draping. Never use the sea plane as a foundation datum. Carve actual lightwell/entrance voids; retain adjacent coverage and every exposed cap.

Depth lift offsets projected depth without raising geometry. Stairs currently use 1 m to render above layered survey surfaces. That is not a universal apron value: an excessive bias can draw a buried surface through the foundation. An apron on a layer-0 site may require a much smaller offset. Inspect shadows on/off, oblique views and actual mesh heights before adjusting either geometry or bias. Distinct shader variants must have distinct program cache keys. Studio removes the standard `gl_Position.z += projectionMatrix[2][2] * ...;` survey-lift statements after the model material hooks run, retaining other shader logic and using a small polygon offset for coplanar ground contacts. Do not introduce an alternative atlas depth-lift expression without extending this adapter and its occlusion regression test.

## Change boundaries

Keep assembly refactors separate from architectural corrections in the evidence and staged diff. For a neutral refactor, compare current accepted geometry, generated data and fixed atlas views before/after on identical inputs. Browser bundle filenames can change because of module movement even when pixels are identical. Never overwrite a failed baseline automatically. Retain standalone study helpers that still support diagnosis; delete duplicate/obsolete implementations only after searching imports and verifying callers.
