# Existing implementations as examples

These examples illustrate implementation approaches, not the default target of studio. Start a new building with NEW-BUILDING.md. Each building keeps its own evidence and proportions.

## Current building paths

| Building | Assembly |
| --- | --- |
| Kesk 1 | `index.ts` fits the plan and carves the entrance; `model.ts` creates its bespoke shell, balconies, openings, foundation and site details; `surfaces.ts` owns versioned shared textures. The separate rear surroundings generator participates in adapter cleanup. |
| Kesk 5 | `config.ts` records design and balcony schedule; `offset-slab.ts` creates the plain shell/audit; `entrance-detail.ts` applies supported details; `split-wall.ts` and `lintel-surfaces.ts` handle real cutouts and returns. The adapter applies stair depth lift, batches geometry using `studio/assembly/batch.ts`, places it, and exposes texture switches. `ground.ts` grades/cuts the prepared site. |
| Rodina | `plain-model.ts` builds the plain volumes, access, shell and services; `detailed-model.ts` adds materials, joinery and ornament with `detail-tools.ts`. The adapter adds picking attributes and stair-specific depth lift, places the model, and initially displays compact detail before full geometry is ready. `terrain.ts`/`terrain-data.ts` support local heights; `ground.ts` adapts actual survey layers. |

These are address-specific generators, not interchangeable archetypes. In particular, Kesk 1's edge numbers and openings are not a generic apartment-building specification. Reuse focused utilities only where their assumptions match.
