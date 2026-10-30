# Start a new building

Studio supports every building in the atlas catalogue. An existing refined model is not required. The project adapter selects the town; each building brings its own geometry and evidence.

## Identify and study

Start `npm run studio`, search by address or stable ID, then select the building. **Original survey** displays the committed survey geometry before refinement/draping. **Provisional massing** extrudes its imported footprint using the approximate height envelope. It is only a starting volume: its roof form, datum, attachments and façade layout are not architectural facts. Review terrain and orientation before adopting any values.

Inspect available Street View and search the web for reference photographs, then reconcile the actual images using [PROCESS.md](PROCESS.md). Confirm each image depicts the correct building. If these sources cannot supply adequate references, ask the user whether they have photos of the specific missing elevation or detail; keep that part provisional while continuing supported work. Keep photos, reference links, imagery dates, measured/inferred dimensions, schedules, uncertainty and approval records in a local directory outside the checkout. Do not adopt another building's layout or dimensions without target-building evidence. Before creating assets, follow [REUSE.md](REUSE.md): inspect existing textures, details, fittings, fixtures and components for exact/near-identical matches, reuse suitable sources and include the choices and visible differences in every refinement review. A plain-shell pass records future candidates without applying finished surfaces early.

## Create a working draft

Choose the building's actual ID from the selector and a unique directory name. Replace these placeholders:

```sh
npm run studio:new -- --id <building-id> --slug <building-name> --out ../sillamae-local/<building-name>/start
```

The command creates four TypeScript files in `src/city/sillamae/<building-name>/` and an initial record outside the checkout. It refuses existing directories and registered buildings. It does not modify the city registration or replace any survey building in the atlas.

| File | What to refine |
| --- | --- |
| `design.ts` | Original footprint and provisional height/datum. Replace estimates only with recorded measured or inferred values; preserve the original in the local record. Add your own typed elevation/component schedules. |
| `model.ts` | Starts with a plain massing generator. Progressively replace it with this building's shell, real openings, access, roof, materials and supported detail. Return `StudyModel` with explicit cleanup and optional texture/ready hooks. |
| `study.ts` | Registers **Working draft** automatically with the viewer. Add named stages such as `shell`, `access` or `detail` as needed; keep the accepted earlier generator available for comparisons. |
| `index.ts` | A production `BuildingOverride` adapter, prepared but unregistered. Add entrances, ground carving/patches and production behavior appropriate to the actual model before integration. |

Refresh studio after creating the files; choose the ID and **Working draft**. Edit source and rebuild the view. The same building can expose multiple stages without changing the viewer:

```ts
export const study: StudyDefinition = {
  id: 'the-stable-building-id',
  stages: {
    shell: {label: 'Plain shell', build: createShell},
    detail: {label: 'Working detail', build: createDetailedBuilding},
  },
};
```

Factories receive `OverrideContext`: building, frame, terrain, site ground, scene and optional change notification. They return the root plus disposal, optional texture toggle and readiness. Factories can share components without duplicating the whole model. `survey`, `massing` and `assembled` are reserved stages. The viewer waits for readiness, releases superseded loads and rebuilds without mutating source inputs.

Keep one correction active. Establish the plain shell before detail, compare actual source imagery, and implement independent tests for each consequential relationship. The starter extrusion does not supply a universal architectural style. Add genuinely reusable low-level tools under `studio/assembly`; keep building-specific geometry and assumptions in its own folder.

## Verify the active draft

```sh
npm run studio:check -- --out ../sillamae-local/<building-name>/run-001/checks
npm run studio:capture -- --url http://127.0.0.1:5174 --id <building-id> --stage draft --out ../sillamae-local/<building-name>/run-001/views
```

Capture defaults to the selected building's draft, production assembly or original survey, in that order. It includes the selected building's atlas context, eight study directions, lighting/shadow matrix, texture/plain-material restoration, distances and available stages. Capture `--compare <previous-views>` requires equal named images and pixels. Keep intentional differences explained; preserve the old baseline.

Inspect close features, matching reference angles, roof/ground contacts and motion in addition to these overview captures. Add local evidence and findings as described in [README.md](README.md). Exit 2 from `studio:check` means technical checks passed but visual review is pending. No tool grants architectural approval.

## Integrate after review

Make the production adapter build the reviewed generator. Review any needed footprint fitting, lightwell/entrance carving, terrain grading, texture lifetimes, LOD, picking and entrance positions. Register `refined` in `src/city/sillamae/index.ts` under the stable ID. Run data generation, checks and a build; compare the draft against its actual atlas placement, including survey depth layering, vegetation, complete shadows and loading behavior.

Once registered, **Atlas assembly** appears automatically. `studio:snapshot --id <building-id>` can then check production geometry, texture restoration and LOD. Before registering it, test the draft with your model-specific Node checks and studio captures. Keep preserved accepted models unchanged unless the active work affects a shared component. Shared changes require technical parity checks for affected buildings without reopening their architectural approvals.

The source and reusable instructions belong in Git. Reference photos, review reports, approvals, comparisons, logs and backups remain in each collaborator's local folders. Commit/push only after the requested review.
