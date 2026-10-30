# Reuse textures, details, fittings and fixtures

Before creating or duplicating an asset for a building, inspect the repository for an existing identical or near-identical texture, material, detail, fitting, fixture or component. Prefer suitable reuse to reduce duplicate files, downloads and runtime resources. Include a reuse summary in **every building refinement review**, so the owner can decide whether an existing match is acceptable or a new asset is needed. This also applies to resumed studies and corrections.

## Find and compare candidates

1. Establish what the target building's photographs actually show. Search existing texture files, material factories, component generators and their consumers; inspect the actual images and rendered parts, not filenames alone. Record which locations and candidates were checked, including unsuccessful searches.
2. Compare each plausible candidate against the target's clearest verified reference. For textures check physical scale, brick bond, colour, grain, relief, roughness, weathering, UV direction and minification. For parts check dimensions/proportions, profile, pane/bar layout, handedness, mounting, contacts, silhouette, material and close/distant appearance. A similar building type alone is insufficient evidence.
3. Classify the candidate using the table below. Record source path, asset/component ID or exported symbol, version/hash, source building and known consumers. Separate reuse of a construction method from reuse of a finished appearance or complete part.
4. Reuse suitable source assets or parameterised factories by reference. Keep placement, counts, dimensions and feature schedules specific to the target and supported by its own imagery. A reusable window generator does not establish the target's window size or layout. Never transfer another building's approvals or silently inherit its weathering and replacements.
5. Check new or changed variants at matching reference views, close and distant, in sun/shade and camera motion. Record unsupported differences and keep them provisional. Shared-source changes require preservation checks for every affected consumer.

| Classification | Action and review requirement |
| --- | --- |
| Exact match at inspected detail | Prefer direct reuse. Report its source, comparison evidence and unchanged settings; do not claim measurements or hidden details were verified. The owner can still request a new variant. |
| Near-identical | Prefer an existing asset or a parameterised variant where supported. List visible differences, changed parameters and uncertainty. A trial may remain provisional in the study; present the choice of keeping it, adjusting it or creating a new asset for the owner to decide. Do not mark an unaccepted approximation approved. |
| No suitable match | Record what was searched, why candidates fail and why a new asset is needed. Keep any new asset separate from existing accepted assets and report it in the review. |
| Uncertain | State the missing comparison/reference. Keep the choice provisional and request the specific missing evidence when needed under PROCESS.md. Do not present an uncertain candidate as identical. |

Reuse is encouraged, including across different building types, when the actual visible part matches. The prohibition on copying an unrelated building's architecture concerns unsupported layouts and dimensions; it does not prohibit verified reuse of matching parts.

## Current source locations

| Location | What to inspect |
| --- | --- |
| `src/studio/assembly/` | Shared massing and batching tools; the home for genuinely city-independent assembly/component helpers. |
| `src/city/sillamae/*/textures/` and `*/surfaces.ts` | Existing versioned bitmap assets and their loaders/settings. Kesk 1 already references masonry and felt images stored under Kesk 5. |
| `src/city/sillamae/rodina/detail-materials.ts`, `detail-tools.ts` | Procedural surfaces and detail-building helpers; inspect their building-specific assumptions before extraction. |
| `src/city/sillamae/*/model.ts` and other per-building assembly modules | Candidate details, fittings, fixtures and construction methods. These are not automatically general-purpose parts. |

Keep one canonical source for an unchanged shared asset. Do not copy a PNG or whole building generator into each new building. Existing paths may remain canonical; moving them is not required to reuse them. When a scoped extraction is justified, put city-independent component code under `src/studio/assembly/`, and town-specific shared texture assets/loaders or component variants under `src/city/sillamae/shared/`. The latter is a destination for future extractions, not a claim that a central library already exists. Keep building schedules and unsupported assumptions in the building folder. Do not import a complete heavy model merely to obtain a small fixture. Keep evidence, comparison renders, reuse decisions and approval records outside the checkout.

## Share resources without coupling buildings

- Reuse a canonical image URL and suitable cached texture/geometry where feasible. Referencing the same PNG saves duplicate source files and can share browser transfer caching; creating multiple `THREE.Texture` objects can still duplicate GPU allocations. Reusing a generator alone does not prove a download, GPU-memory or draw-call saving.
- Keep material instances independent where colour, roughness, toggles or other settings differ. Do not mutate a shared texture's repeat, offset, rotation, colour space or filtering for one building and change all consumers. Use appropriate per-instance UVs/settings or an explicit variant; record differences such as `flipY` instead of merging incompatible loaders blindly.
- Define shared-resource ownership and cleanup. Unloading, toggling, cancelling or recreating one building must not dispose or alter resources still used by another. Avoid regenerating identical procedural textures for every instance where a safe shared resource suffices.
- Parameterise only evidenced differences. Preserve pivots, anchors, units, normals, openings, contacts, picking, LOD and compatible batching/instancing behavior. Do not stretch a detailed part until it loses its reference proportions.
- Version a changed shared asset or offer an opt-in variant when its appearance differs. Do not overwrite an accepted asset for all buildings to improve the current one. A neutral extraction must preserve existing consumers' geometry/materials and fixed views; intentional changes need their own recorded review scope.
- Report resource effects under stated conditions: reused versus new files/bytes, cold/warm loading where measured, texture/geometry allocations and draw calls when relevant. Label estimates and unmeasured effects explicitly. Asset reuse is a means to reduce space and loading cost, not proof that loading became faster.

## Required refinement-review summary

Include a concise **Reuse and new assets** section in the user-facing review, with a link to the local detailed inventory. Include retained reuse as well as newly proposed reuse, rejected candidates, genuinely new assets and owner choices still pending. For a plain-shell review, identify currently reused tools/parts and planned surface/detail candidates, clearly marked not yet applied; this requirement does not advance the study past shape review.

Use one row per feature or meaningful asset family:

| Target feature / location | Source building, canonical path, symbol/ID and version/hash | Match and target-reference comparison | Reused / parameterised variant / new / deferred; settings and visible differences | Resource effect and measurement conditions | Owner choice / decision |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

For each near-identical candidate, explain the visible compromise plainly and present the available choices: retain the match, adjust an evidenced variant, or create a new asset. Record the owner's exact decision, date, version and scope locally; a decision about one feature is not approval of the building. If no suitable matches were found, state that and list the search coverage instead of omitting the summary. Continue independent supported work while a choice remains open.

Use the reuse section in [the building record](templates/building-record.md) and `reuseReview` in [the visual-review template](templates/visual-review.json). Review metadata and this checklist are currently checked by the collaborator: `studio:finalize` does not automatically judge similarity, validate `reuseReview`, measure savings or grant owner approval. Include relevant visual/resource findings in the existing reference, close, distance and runtime gates.

Each `reuseReview.items` entry records `feature`, `sourceBuilding`, `sourcePath`, `sourceId`, `sourceVersionOrHash`, `classification`, `referenceEvidence`, `action`, `parameters`, `visibleDifferences`, `resourceEffect` and `ownerChoice`, corresponding to the table above. Use `status: "pending"` while the inventory or relevant owner choices are open; a completed inventory is not architectural approval.
