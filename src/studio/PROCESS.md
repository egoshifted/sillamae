# Study and refinement process

For any new building, begin with [NEW-BUILDING.md](NEW-BUILDING.md), select its stable ID and create a separate working draft. Use this sequence for the active building, with [refinement rules](REFINEMENT-RULES.md) and [D01–D20](COMPONENTS.md). Technical parity, visual findings and architectural approval are distinct. Older approved buildings retain their status unless a requested change or reported defect affects them.

1. **Establish scope.** Confirm stable ID, address, region and orientation. Read the local building record and ordered correction queue. Record the latest instruction and protected components. Preserve any agreed focus-area priority locally; do not invent a new area programme.
2. **Preserve the starting point.** Copy affected source/assets and record SHA-256 hashes outside the checkout. Save recoverable before views with viewport, camera, light, quality and toggles. Preserve original imagery, baselines and approvals.
3. **Study references.** Inspect available Street View for each accessible elevation, including historical views where helpful, and search the web for additional reference photographs using the verified address, building name and local-language variants. Inspect the actual images, confirm building identity and reconcile them with roof aerials and supplied photos. Record queries, sources inspected, coverage gaps and access limitations locally. Record source URL/file/hash, imagery date, inspection date, orientation, supported feature and uncertainty. A saved link is not an inspected image. Reconcile renovations; do not silently mix dates. If Street View and web searches cannot supply adequate references, ask the user whether they have photos of the specific missing elevation or detail. Continue supported work and keep dependent geometry provisional.

   Before creating assets, perform the [reuse search](REUSE.md): compare existing textures, details, fittings, fixtures and components against the target references; record exact/near matches, rejected candidates, uncertainty and canonical source paths. Revisit the inventory before each new surface/detail pass.

4. **Establish the plain shape.** Separate measured values from inferred ranges. Establish main volumes, attachments, connected plan directions, setbacks, roof levels, openings and datum. Preserve source footprint and record fitting displacement. Show plain materials without obstructing vegetation, matched to reference angles, plus plan and depth views. Resolve layout corrections before detail.
5. **Schedule elevations.** Define basement and zero-based code floors versus L1. Count windows, blank bays and basement openings independently. Schedule every balcony stack/floor, including open/enclosed state, frame variation, slabs, rails and recesses. No random architectural variation or unsupported transfer of layouts/dimensions from another address; reuse verified matching components with target-specific parameters under REUSE.md.
6. **Build shell and contacts.** Use real openings and reveals, consistent wall breakpoints above/below datum, closed exposed ends and actual ground samples. Check fronts, returns, full contact depth and negative space. Do not use a black panel or double-sided material to conceal missing construction.
7. **Complete assemblies.** Compare each entrance, annex, roof, parapet, coping, service and distinctive attachment separately. Preserve dimensional anchors: changing width must not silently move an endpoint or projection. Surroundings remain independently recorded.
8. **Apply surfaces and performance controls.** Prefer suitable canonical assets or parameterised components from the reuse inventory before generating new ones. Keep near-match differences provisional and visible to the owner; share resources safely and record measured versus estimated savings under REUSE.md. Match physical texture scale, colour/height alignment and material boundaries. Review sun/shade and minification. Batch only compatible geometry; preserve silhouettes, openings and supported detail in LOD. Record costs under explicit conditions; desktop emulation is not physical mobile testing.
9. **Verify one correction.** Record the defect, diagnose it, write an expectation independent of the implementation, make the smallest coherent correction and test adjacent features. Where useful, demonstrate the test rejects the actual old defect. Run `studio:check` and appropriate model/geometry checks. Exit 2 still requires visual work.
10. **Inspect fresh evidence.** Capture after checks with unchanged source hashes. Review matching references, all eight directions, close details, roof, contact perimeters, medium/far, morning/midday/late, shadows off/on, vegetation hidden/restored and the complete cast shadow. Include slow/rapid camera movement and LOD transitions. Shared rendering/terrain changes need affected neighbours and East/Centre/West coverage. Mark uninspected or obscured details pending.
11. **Record and review.** Include a **Reuse and new assets** summary with sources, exact/near-match evidence, applied variants and visible differences, rejected/new assets, resource effects and pending owner choices. Give the owner the choice to retain, adjust or replace near matches; record their exact decisions locally. Complete local findings, known failures and uncertainty; validate the evidence record with `studio:finalize`. Ready for review requires resolved implementation defects, not merely a green test. Only the project owner grants architectural approval; save the exact statement, date, scope and version locally.
12. **Continue the agreed queue.** A new defect reopens the affected item, preserving unrelated approvals. Fresh source changes invalidate earlier visual sign-off. Update general lessons in studio; retain building-specific progress locally. Prepare a scoped diff/commit only when requested; publishing requires authorization.

## Study versus atlas

Use studio to isolate geometry and compare plain/detail representations with a common camera. The [studio tools](TOOLS.md) can measure and try changes, but their edits are not evidence and never reach the atlas. Use the atlas for actual survey layers, depth bias, vegetation, surroundings, selection, loading and runtime lighting. Never treat a clean diagnostic ground plane as proof of atlas contact. For a lighting suspicion, hold the camera fixed, switch shadows off, then inspect actual geometry and depth/material overlap. A surface still visible with shadows off can be a depth-buffer artifact.

For every pass record what was inspected and its limits. Static overview screenshots cannot validate every reveal, motion stability, photo-derived dimensions or mobile performance. A regression test derived from the same erroneous dimensions can preserve the error; reference expectations and negative controls must remain independent.

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
