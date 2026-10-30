# Sillamäe building refinement rules

Current repository edition. Consolidated from the established refinement rules and subsequent lessons; operational commands live in README.md.

Apply this workflow to every subsequent building and to corrections of previously refined buildings. The aim is an identifiable, reference-faithful building at close range, with efficient rendering at town scale. Kesk 1 provides lessons about the process; its architectural details are not a template to copy onto other buildings.

## 1. Keep an ordered record

- Record every user correction against its building before moving on. Combine related corrections into the current building’s checklist; retain the remaining queue in order.
- Track buildings separately under East, Centre and West. Keep earlier pixel-atlas work distinct from a verified 3D refinement.
- Use statuses: Awaiting 3D refinement, In progress, Needs reference, Ready for review, and Approved. Only Anton’s approval makes a building Approved.
- Record completed changes, reference links and imagery dates, unresolved details, and the next action. Do not mark a whole building complete while a known correction remains unresolved.

## 2. Collect evidence before modelling

- Confirm the address, footprint and orientation. Name elevations by compass direction and a visible landmark or street, so “front”, “rear”, and “left” cannot be confused after rotation.
- Inspect available Street View for every accessible elevation, including historical imagery where it reveals obscured features. Use aerial photographs for roof form and placement; use user photographs for close details.
- Search the web for additional reference photographs using the verified address, building name and relevant local-language variants. Inspect the source images and confirm they depict the correct building; search results and captions alone do not establish a feature. Record the queries, sources inspected and coverage gaps locally, including unsuccessful searches or unavailable access.
- Save the relevant view link, imagery date and the feature it supports. A link alone is not evidence that it has been inspected.
- Prefer the clearest relevant reference; reconcile differences in date, renovations, perspective and occlusion. Do not mix incompatible historical states silently. Keep winter, snow and evening illumination out of a summer model unless requested.
- If Street View and web searches cannot provide adequate references, or access is unavailable, ask the user whether they have reference photos of the specific missing elevation or detail. Record the gap and continue supported work; keep dependent geometry provisional. Do not invent a hidden elevation to finish the checklist.

### Reuse matching assets and parts

Before authoring or duplicating a texture, material, detail, fitting, fixture or component, follow [REUSE.md](REUSE.md). Inspect existing repository assets and rendered parts against this building's references; classify exact matches, near-identical candidates, unsuitable candidates and uncertainty. Prefer supported reuse by canonical reference or parameterised factory. This applies across buildings without transferring unsupported layouts, dimensions, appearance or approvals.

Every refinement review must include **Reuse and new assets**: source paths/versions, target-reference comparisons, what was reused or adapted, visible differences, genuinely new assets and their justification, resource effects with measured/estimated/unmeasured labels, and owner choices. Present near-identical alternatives so the owner can retain the match, request an adjustment or choose a new asset. Keep undecided approximations provisional and save exact decisions outside the repository. Plain-shape reviews report applied utilities/parts and future candidates without adding finishes early.

Keep one canonical asset, safe texture/geometry lifetimes and independent per-building material settings where needed. Sharing source files is not proof of shared GPU resources or faster loading. Avoid duplicate files and unnecessary heavy-model imports; preserve all existing consumers when extracting or changing shared assets. See REUSE.md for storage, compatibility, ownership and preservation checks.

## 3. Establish dimensions and proportions

- Use surveyed footprints or other measured data where available. Verify that adjoining parts belong to the same building.
- Where measurements are absent, compare proportions against visible features in the same façade plane, and check a second angle. Perspective-distorted pixel widths are not real-world dimensions.
- Record an inferred dimension as approximate and identify its basis. Do not choose an arbitrary depth or width simply because it looks reasonable in the model.
- Check annex extent in both directions: how far it runs along a wall and how far it projects out. Check its end against the main building line, balcony edge, recess and nearby doorway. A change to one dimension must not accidentally change another.
- Keep uncertain geometry provisional. If references cannot resolve a consequential dimension, leave it flagged rather than presenting it as measured.

### Establish the shape before adding detail

- First establish the overall shape from the references: main volumes, attachments, roof levels, raised walls, recesses, openings and ground levels. Reconcile different views before adding detail.
- Show Anton a simple model view with trees and other obstructing vegetation temporarily hidden, using plain materials so the layout is easy to assess. Match the reference angles and include another angle where needed to explain depth.
- Resolve layout corrections with Anton before adding finished materials and small details. Do not repeatedly patch detailed geometry around an unresolved overall shape.
- Restore vegetation for the finished scene; hiding it is a review aid, not a permanent removal.

## 4. Survey each façade separately

Create a small elevation schedule before coding: floor, horizontal position, opening type, size/proportion, frame colour, recess/projection, and distinctive details. Define floor numbering explicitly, with basement separate and L1 the first occupied floor above it.

- Count window rows and columns individually. Check missing openings, blank walls, narrow staircase windows, offsets and alignment. Do not assume all floors or opposite sides match.
- Check basement windows independently, including alignment with the column above or centring beneath a balcony. Remove generic windows that the reference does not show.
- Model the foundation’s height, colour, texture and relation to terrain. Check that steps and foundation walls meet the ground without floating or sinking.
- Include visible concrete lintels, sills, reveals, wall returns and depth. Windows should not read as stickers placed on a flat wall.

## 5. Treat balconies as individual units

- Identify every balcony stack, including recessed middle stacks. Count floors within each stack.
- Distinguish open balconies from enclosed glazing. An open balcony has a recessed rear wall, door/windows, floor slab, ceiling and front railing; it must not receive invented front glass.
- Match white, wooden and brown frames, pane counts, transoms, irregular replacements and curtains where visible. Do not generate random variation as a substitute for observation.
- Include corrugated panels, their vertical direction, top cladding bands, slab thickness, balcony side walls and supports.
- Check the space below the first balcony: foundation position, recess depth, supporting piers and any window in the back wall. Shade should arise from depth rather than a flat black panel concealing missing geometry.
- Model visible grilles completely, including the full spoke range, perimeter and cross-members. Compare the silhouette to the close reference, not merely the presence of a grille.

## 6. Inspect entrances, annexes and roof

- Look for every entrance, including rear, side and basement access. Record door position, landing height, short stairs, stair direction, canopy, handrails and adjoining windows.
- Match visible door colour, glazing, handle, intercom and lighting fixture at useful close-up detail. Avoid copying one entrance onto another without evidence.
- Check annex material, roof edge, height, footprint, attachment and flush alignments. Preserve the distinction between an annex, a canopy and a stair landing.
- Use aerial and ground views together for roof outline, parapets, coping, lift housing, vents and material colours. Do not mistake a solid parapet or corrugated strip for an open railing.
- Place rooftop structures from evidence. If Anton explicitly authorizes a simplified shape or approximate position, record that exception; it does not establish a rule for other buildings.

## 7. Capture distinctive details and surroundings

- Inspect address plaques, street names, ornament, brick patterns, dates, satellite dishes, flower boxes, grilles, benches and nearby paths.
- Match their actual position, orientation, colour and form. Keep text readable and correctly facing outward.
- Include visible façade pipework and other prominent fixtures where supported. Do not invent decorative objects to make a building feel detailed.
- Check nearby benches, planting and access paths independently from the building mesh. Preserve their placement relative to entrances and pedestrian routes.

## 8. Preserve browser performance and existing work

- Keep detailed geometry near the camera and use appropriate level of detail farther away. Preserve important silhouettes and major openings through transitions.
- Batch compatible geometry and reuse materials/textures. Use geometry for visible depth and silhouettes, and textures for fine surface detail. Optimisation must not remove verified architectural features at close range.
- Keep original backups intact. Make targeted changes to the relevant building and avoid overwriting accepted details elsewhere.
- Avoid overlapping wall surfaces, z-fighting, diagonal seams, floating panels and accidental gaps. Check lighting and shadow behaviour separately from geometry.

## 9. Verify before review

- Compare model and reference from matching orientations, then inspect all eight 45-degree views. Check close, medium and distant zoom, plus more than one sunlight angle.
- Recount windows and balcony floors from the finished model. Verify foundation alignment, open balcony interiors, roof attachments, annex limits and entrance access.
- Check that texture toggles and shadows work, geometry is finite, and the app loads without new errors. Measure performance when the change meaningfully adds rendering cost; record the conditions rather than promising a frame rate.
- Save review screenshots of the changed elevations. Update the log with evidence and remaining uncertainty, then mark Ready for review only when known implementation corrections are resolved.
- When Anton reports a mismatch, reopen that item, fix it from evidence, and check adjacent details for regressions. Record any general lesson here without turning a building-specific feature into a universal rule.

## Per-building review record

Building and region:

Status and current queue position:

Elevation names and reference links with imagery dates:

Measured geometry and source:

Inferred proportions with evidence and confidence:

Floor-by-floor window and balcony schedule:

Entrances, foundation, annex, roof and distinctive details:

Completed changes and verification screenshots:

Outstanding corrections or requested references:

Anton’s approval and any agreed exceptions:


## Local verification and preservation

Use the current studio commands in [README.md](README.md). Keep all evidence and approvals outside the checkout. Never overwrite an original baseline or turn a pending finding into a pass. A source change invalidates earlier visual sign-off. Automated capture is not visual inspection.

### Lessons from the 24 October close-detail regressions

- Use identical breakpoints above and below the ground datum. A small segment straddling a recess can create a projecting foot even when the main wall is correct. Inspect the exact step and both sides, including below datum.
- Foundation piers must close the full depth and width of the brick cheeks above. Test the ends of every balcony stack, not only the middle of its back wall. Compare sunlight on/off to distinguish a hole from a lit apron or shadow.
- Do not add redundant corner patches to conceal a gap. Their horizontal tops may protrude into daylight and create bright flecks. End ground extensions at the wall datum without overlapping coplanar faces.
- Flush lintels need masonry cutouts and four reveal surfaces. Box-shaped reveals can place an invisible front face over the lintel; inspect the lower lintel edge while orbiting from both directions and check coincident ray hits.
- Roof coping must form one continuous outline with correct hole winding and outward-facing normals. Inspect it from inside, outside, above and below the parapet edge. Waterproofing inside the roof is not permission to cover exterior brick corners.
- Material roughness alone does not guarantee a matte appearance. Inspect albedo brightness, world scale, filtering, grain contrast and separate height data. Fine random noise can disappear under minification; increasing resolution must not erase the coarse aggregate or introduce sparkling highlights. Compare roof, annex and canopies in sun and shade.
- Review small attachments at their own close-up views: complete grille silhouette, vent recess, flower-box contact/shadow, timber frame, flag socket, lift door/cowl. A distant overview cannot validate these.
- Test shadows over the entire road/grass footprint at morning, midday and late afternoon, after toggling off/on, with vegetation hidden/restored. Repeat at different zooms and viewport proportions. Camera motion and rapid rotation need separate checks.
- Preserve approved components independently from building status. Record superseding user instructions explicitly; an old accepted colour must not override a later requested change. Never regenerate the refinement log from a stale hardcoded description.

Finalize an inspected run using `studio:finalize`; see README.md. This validates the evidence record and unchanged hashes, not architectural correctness.

## Reopened seam defects — 25 October 2026

A centre-of-window ray or a general screenshot is insufficient to pass an elevation. Inspect the entire visible perimeter of every opening, the full length of wall joins, roof-to-wall contacts, foundation piers and stair-to-apron contacts. Sweep the camera and sunlight; repeat with shadows off to distinguish geometry from shadow errors. An unexplained line, bright slit, detached reveal or grass patch is a failure, not acceptable texture. Check transformed plane-built reveals together with box-built frames. Check every intersection at material transitions for overlapping faces. Record uninspected or UI-obscured areas as pending. A user-reported visible defect immediately reopens the affected visual gate.

For balcony alignment, compare edge azimuths in plan and a top-down view against aerial evidence before changing the footprint. Keep intentional setbacks separate from unintended angular variation.


### Exposed structural end faces — 25 October 2026

A neighbouring wall is not proof that a whole box cap is buried. Terrain-dependent foundations can terminate at different heights. Retain exposed portions and remove only geometrically covered portions; do not mask missing faces with double-sided visible materials. Verify the visible shell using front-face culling from normal and oblique directions across every footprint edge, including below datum. Keep a failing original-model result and a passing repaired-model result. Publish coverage and limits: comparing construction solids cannot detect a solid omitted from both models, so independent opening, terrain, roof, shadow and reference checks still apply. Screenshots obscured by UI and static-only motion checks remain pending.


### Reference-first acceptance — entrance width miss, 25 October 2026
Before treating geometry or lighting tests as progress toward acceptance, explicitly compare the model and supplied Street View relationships: wall endpoints, full assembly extent, door-to-bay proportions, material transitions and canopy-to-wall contacts. A model can be watertight and still architecturally wrong. Record these reference-derived expectations separately and demonstrate that regression checks reject the previously incorrect shape. Do not preserve a guessed dimension simply because old tests use it.


### Connected footprint angles — 26 October 2026
Correct connected wall directions together when references establish right-angle returns. Making selected balcony fronts parallel can leave adjoining returns skewed. Verify every concave/convex corner and the actual stair-to-side-wall contact over their shared depth; checking stair width against its own local axes cannot detect a wedge gap. Retain rounded source coordinates, record fitted displacement and use the same corrected footprint before ground carving, model generation and streamed asset preparation. Preserve historical baselines; compare detailed generators on identical authorized footprint inputs when checking unrelated details.


### Projecting wall strips at ground — 26 October 2026
A full-height wall projection must continue below the model datum when the actual ground is lower. Check its front and both returns against rendered terrain, not only the base wall behind it. When the user specifies a width proportion, record that as an approximation, supersede the earlier estimate explicitly, and check both boundaries at foundation, wall and roof heights. Keep the projection depth independent of its width.


### Balcony crowns and shared roof faces — 26 October 2026
Check the entire crown at its own height, including both ends of every stack. Lower-floor cheek tests cannot validate a full-width upper strip. Roof-covered solids must not retain a second top face just beneath the membrane: millimetre separation can still flicker at grazing angles. Use one visible top surface and retain closed construction solids for independent shell comparison. Compare upper cladding ribs with lower panels and inspect small camera steps with shadows on and off.

## Ordered scope and existing approvals

Follow [PROCESS.md](PROCESS.md) and the owner’s local queue/focus-area record. Approved buildings stay approved; preserve their models, views and history. Reopen only requested or affected work. Shared rendering changes require technical preservation checks without re-accepting unrelated architecture. Surroundings and uncertain dimensions remain separately recorded.

## Masonry widths and connected roof edges —26October2026
Before modelling wall ends, block separators, parapets or roof dividers, inspect visible brick bond on a near-front face and an oblique return. Count length/half-brick units and joints where legible. Record apparent face width, structural wall thickness, outward projection depth, parapet body width, coping width/overhang and metal sheet thickness separately; none is interchangeable. State the assumed brick module and mortar joint, confidence and date; nominal catalogue sizes are a scale check, not proof of historic material or a measured dimension. Cross-check the same wall at its base, facade edge, roof termination and aerial plan. Trace connected widths through the shell, foundations, exposed returns, parapets and divider junctions; do not replace a masonry body with a thin visual line. Compare geometry without shadows so a cast shadow is not counted as width. Add independent transverse probes that reject the former too-thin model, not only centreline coverage. Require a visible before/after width comparison and record unresolved dimensions. These checks belong to D02/D03/D09/D11/D12. For Kesk5 only, Anton brick-and-a-half interpretation supports an inferred0.38m working width; do not copy that value to other buildings without evidence.

## Recessed joins and continuous wall faces —26October2026
Classify each facade endpoint from photographs as exposed convex end, recessed concave junction, or uncertain. Record both presence and absence: a projecting end at one side is not evidence for a second end at a recessed corner. Compare the full join from foundation to roof with the photograph; do not pass generic repeated strips by count. For connected roof dividers, trace both physical wall faces and their top elevation through each return, not only aligned source edges or centreline. Opposite-facing return walls require a thickness-aware common band; equal source boundary coordinates can put their solids on opposite sides. Inspect dense transverse profiles before, at and after every junction, including negative space outside the intended band. Reject lateral steps, nibs, crossing ends and gaps even when there is only one exposed top owner. Keep source coordinates immutable and record any inferred working-face offset separately. Tests must reject the actual previously wrong generator, and matched ground/overhead images must confirm presence/absence and straight faces. A technically watertight or nonoverlapping wrong shape fails reference review. D01/D02/D03/D09/D11 apply.

## Basement openings, lightwells and comparison buildings —26October2026
Inventory basement separately from occupied storeys. Count per block/elevation from user evidence; locate each opening against upper window columns and entrance. When glazing descends below grade, model the complete opening, real cutout in the ground, retaining cheeks/front lip and well floor; check no ground crosses the glazing or well void. Recess beneath lowest balconies needs actual set-back backing wall, soffit and supporting ends, not a dark surface. Verify both ends, ground and slab support. If Anton supplies a sister building for an obscured feature, record that explicit transfer and its limited scope separately from direct evidence; do not copy its window counts, finishes or dimensions without support. D01/D05/D07/D09/D10 apply.

## Exposed side-wall ends on both elevations —27 October 2026
During the reference survey inspect every exposed and recessed end of every block from both main elevations, from foundation through balcony/window levels to roof. Identify structural wall returns and the planes of adjacent infill, balcony fronts and coping; note where the end is visibly proud and where a concave join must remain flush. An entrance-side projection does not establish the same projection depth on a balcony side: compare each visible face and balcony plane directly in matched street, oblique and aerial views. If Anton supplies a sister building for a hidden view, distinguish that evidence from direct photographs and transfer only the authorized relationship; dimensions remain inferred until measured. Model genuine full-height, correctly sized wall ends, including ground support and raised roof connection, and trim adjacent balcony openings only as necessary to preserve those wall ends. Inspect both sides and all roof contacts with shadows on/off, and verify actual rendered projection depth, continuity, concave absence and relative depth independently. A test must reject the previous missing feature; do not claim an elevation checked because another side passed. D01/D02/D03/D07/D09/D11 apply.

## Plain balcony structure and later enclosures —27 October 2026
When a user defers individual balcony enclosures, distinguish them from the underlying balcony slabs, front panels, end supports and roof coverage. Retain structural plain shapes when requested; defer per-unit glazed additions and finishes. Schedule requested rear windows by block/floor, document basement openings separately, and do not infer historical construction from present mixed glazing. Trace the roof edge relative to the top balcony in both depth and elevation. Check exposed corner geometry for duplicated cheeks and protruding caps; keep one visible owner for coplanar roof/wall surfaces. Test thin roof shadow casting under grazing sunlight and inspect the complete shadow, not just daytime overview. Distinguish direct building photos, sister-building comparisons, undated aerials and ambiguous map context. D01/D05/D07/D08/D09/D11/D18 apply.

## Continuous panels, closed corners and roof ledges —27 October 2026
For every model with balconies or similar assemblies, check the actual rendered triangles and compare them with the current building references, not a generic design: (1) full-height panel face has no unintended stripe, gap, extra lower layer or coplanar duplicate; (2) each panel and slab reaches its owning wall at both ends; (3) every recessed corner is opaque through its complete shared depth and storey height from both directions, including below datum; (4) the roof edge/ledge is one continuous profile, with reference-supported projection rather than a second stacked layer. Record whether each check is applicable; adapters must supply model-specific reference-derived contacts and probes to the shared geometry-contract validator. Run negative controls reproducing the original broken geometry. A count or centreline-only probe cannot establish full contact; sweep across the width and at both ends, compare shadows on/off, and record measured versus inferred dimensions. Do not copy Kesk5 values to unrelated buildings. D01/D03/D07/D08/D09/D11/D19 apply.

## Reference-backed geometric checks —27 October 2026
For each applicable model and each panel-contact, corner-closure, roof-ledge and continuity contract, attach the clearest supplied photograph or accessible dated Street View image, record its identity, date, building, user observations, human interpretation, source-image hash, confidence, and any measurable or inferred range. Automated adapters must load and hash-check the recorded source and compare actual geometry against the separately recorded reference-derived expectation. A green numerical test does not mean a computer has interpreted the photograph: inspect and record matched model/reference views, investigate visible mismatches, and mark obscured details unresolved. A sister-building image and the user-authorized transfer must be labelled, not represented as direct evidence. Use additional supplied images and Street View where available; do not repeatedly reopen an approved older building just to check another one. D01/D02/D03/D07/D08/D09/D11/D19 apply.

## Reference comparison at junctions — 27 October 2026
For each repeated balcony or facade junction, identify the actual wall in the supplied aerial and dated Street View, then compare the model at matching oblique and near-front angles. Check both presence and absence: a panel must reach the existing wall and no intermediate strip, pier, duplicate cheek or protrusion may occupy the opening unless supported by the photograph. Examine top and foundation separately. A contact test alone can pass against a wrongly invented wall; add probes through the open area and a negative test using the rejected geometry. Record photo date, vantage, occlusion, uncertainties and any mismatch, fix supported mismatches, then compare again. This applies to all applicable models; automated adapters need model-specific reference interpretation.

## Vertical clearances and window heads — 27 October 2026
Compare visible ground to the underside of first balconies or overhangs, and window heads to the roof or upper ledge, using the actual building photos and dated Street View where possible. Consider reference objects such as a mobility scooter as qualitative scale only, without assuming a specific model or exact height. Inspect several bays and both ends, separate soffit height from panel bottom and actual terrain, record occlusion and dates, and use inferred ranges instead of claiming survey precision. Add actual-geometry tests for each relevant vertical relationship and a negative control from a rejected model. Recheck other affected levels and openings after changing proportions.

## Seams and shadow diagnosis — 27 October 2026
Compare close views with shadows on and off, across multiple lights and motion. Inspect outer wall and roof junction surface ownership for duplicate coplanar geometry, open joins, protruding strips and real material breaks; distinguish those from shadow acne, resolution or bias artifacts. Check full cast shadows for leaks and detachment after tuning. Record limits and any unresolved seam. Apply the same visual and geometry checks to all applicable models; do not equate a clean automated ownership sample with a complete visual inspection.

## False wall linings — 27 October 2026
Compare both ends of each repeated wall directly with available photographs and Street View. A surface may have a single geometric owner and still look like a separate lining when adjoining coplanar faces have mismatched smoothed shading normals. Check plane, material and interpolated normals across both sides of junctions and at multiple heights; inspect with shadows on and off. Preserve actual wall projections that the references support. Add a negative test from the rejected model and do not infer the cause from a single ownership probe.

## Roof-edge thickness versus projection — 27 October 2026
Measure and compare opposite and repeated roof-edge wall thicknesses separately from their outward projection, height and roof setback. If references indicate the edges match, enforce equal thickness without turning a shallow overhang into the full wall width or adding a second roof layer. Use actual geometry bounds, inspect joins from above and obliquely, and retain a negative control using the rejected thin-edge model. Values inferred from imagery remain provisional.

## Terrain datum and contact checks — 27 October 2026
When a study's ground is offset below local zero, compare actual rendered step undersides and ground surfaces rather than assuming both are at zero. A 15 mm gap recurred in the Kesk 5 draft despite an apparently connected landing. Check step-to-landing contact and step-to-ground contact independently. When the imported ground buries entrances, retain the original mesh and datum evidence, compare roof/foundation levels with photographs, and document any user-authorized local grading as provisional. Cut lightwell voids through the actual adapted surface and sample the interior near edges as well as at the centre; keep a negative control showing the original burial. Adaptation does not establish surveyed ground or justify moving roof levels without supporting evidence.

## Overlapping terrain ownership during grading — 27 October 2026
Before flattening or grading an imported terrain region, resolve overlapping source layers in plan. Bringing different layers to the same height can create coplanar flicker even when the doorway and lightwell probes pass. Remove coincident duplicates while preserving genuinely separated underlying surfaces where they provide oblique coverage at raised edges. Test both near-vertical and shallow-angle rays, and compare both sides of shared edges against the original terrain. Keep a negative control from the overlapping draft. Do not use relaxed depth bias or a hidden material to conceal duplicate surfaces. A sampled edge test does not establish complete seam-free coverage.


Procedural material review: inspect textured roofs at close and neighbourhood distances under changing light. Reject visible repeated waves or checker patterns unsupported by imagery; mipmapped grain must remain subordinate to the observed surface. Compare the actual rendered atlas, not only a texture swatch.

## Progressive refined-model loading — 27 October 2026
For an initial close view, do not block the atlas render loop on full-detail texture download and transcode. Request a compact representation concurrently, retain it until full detail is ready, and check failure, cancellation, reload and transitions. Preserve the approved full representation and document observed loading conditions. A visible compact fallback is not architectural approval.
## Entrance evidence and progressive fallback — 27 October 2026
Compare each entrance individually with its dated view, including both sides of the landing, rail posts, rail direction and canopy drainage. A rail present at one entrance does not establish it at every entrance; record obscured cases. For multi-light windows compare pane proportions and individual replacements, not merely the number of mullions. Treat any generic proportions as an inferred interim pattern until each visible unit is reconciled.
Exercise actual refined-loader behavior with full preparation delayed and failed: the compact fallback must become visible, remain available after a full-detail error, and be replaced after retry; check offscreen release as well. A cache-only test does not establish the selected building's visible fallback.


## Recessed glazing and return finishes — 28 October 2026
Lightwell probes must include the strip between the external facade plane and actual recessed glass, at both jambs and the window centre. An outside-only cutout can leave grass visible through the lower glazing despite passing centre-of-well tests. Preserve surrounding ground coverage and test the actual old grass strip as a negative control. Inspect basement lintels independently from upper-floor rules and add them where direct imagery shows them.

Audit shared-return/end-cap materials as well as geometry: a closed surface left in plain study material can make masonry appear to stop short. Check colour/height texture ownership and metre-scale UVs on side faces through the full depth, with foundation finish retained separately. Reusing a surface should reference the existing assets and safe shared lifetimes; keep each building’s materials independent and preserve approved model/texture inputs.

## Apron depth and foundation visibility

Shader depth lift changes visibility without moving geometry. A large lift on a ground apron can draw buried triangles through a foundation and imitate raised or jagged feet. Compare identical views with shadows off, inspect actual heights and nearby survey layers, then use the smallest appropriate offset for that surface. Keep stair/road requirements separate. Give shader variants distinct cache keys and recheck full cast shadows and low-angle camera motion.
