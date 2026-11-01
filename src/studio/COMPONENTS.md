# Component checklist

Apply D01–D20 to the building currently being developed. Historical examples explain the lessons only; their IDs, counts, dimensions and approvals do not define the new building or the studio catalogue. Record non-applicable items explicitly.

Use the following checks during stages 3–10, not as an optional final read. For every applicable item record **Pending**, **Passed**, **Failed**, **Needs reference**, or **Not applicable with reason** in the building's own checklist. Each Passed entry needs its reference, implementation location and inspected evidence. A statement such as “windows done” cannot close the individual window, reveal, lintel, sill and shadow checks. An existing component must also be checked; this is not merely a list of things to add.

Kesk 1 examples below explain why a check exists. Their dimensions, edge numbers, colours and counts belong to Kesk 1 only. Use the current specification and latest correction records when reopening it; older task-log measurements may have been superseded. Do not turn every example into a feature on the next building.

### D01 Reference inventory and completeness

- Inspect available Street View and run web searches for reference photographs of the verified building. Record queries, inspected sources, dates, identity checks, coverage gaps and access limitations in the local record. If these sources leave a gap, ask the user whether they have photos of the missing elevation or detail; keep unsupported features provisional.

- Inspect each elevation systematically from ground to roof and left to right, then repeat from the opposite direction. Mark obscured areas explicitly. Do not assume the hidden half mirrors the visible half.
- Distinguish aerial evidence of plan geometry from oblique Street View evidence of façade proportions. A roof product photograph can support profile or finish, not the building's dimensions or location.
- Record which image establishes each detail: a close-up of the material, a wider shot locating it, and a second angle explaining depth where available. Retain user annotations alongside an unannotated source if available.
- Record visible image dates rather than assigning the date the image was supplied. Reconcile changes between 2012, 2023 and 2024 views before combining them. Retain the missing-image manifest; a historical note does not substitute for a new inspection of an unavailable image.
- Distinguish structural facts, approximate geometry, observed appearance and artistic approximation. A stain is evidence of appearance, not a surveyed drainage level. A building's function must not be inferred from an unverified label such as “plantroom”.
- Before implementing a detail, write a testable sentence: “The canopy reaches the right brickwork endpoint while the door remains centred in this bay,” rather than “make entrance better”.

**Acceptance:** every modelled feature has a source or an explicit user-authorized approximation; unresolved consequential features stay visible in the record.

### D02 Dimensions and anchored changes

- Schedule overall height, occupied floor count, floor pitch, basement exposure, footprint segment lengths, setbacks, wall thicknesses, balcony widths/depths, annex extents, parapet heights and ground levels separately.
- For each dimension save its datum, start/end anchors and dependency. Identify which endpoint must remain fixed when changing a length. Kesk 1's annex was shortened at the far end while its entrance end stayed fixed; shifting the whole annex would have broken an accepted relationship.
- Separate length along a wall, projection from it, height and thickness. Changing one must not silently scale the others. Check the annex against the first window column, outer wing, recessed wall and adjacent balcony independently.
- Compare several visible ratios in one façade plane. Six visible paving slabs do not supply an absolute width unless slab size is known. Do not calibrate an annex from an unrelated balcony in a different perspective plane.
- For a proportional request, record the fraction and affected span. Kesk 1's E7 strip is approximately one-third of its wall, centred, with its existing 0.12 m depth retained; the former 60% interpretation is superseded.
- After any plan or height change, recheck attached roofs, foundation breaks, stairs, canopy endpoints, openings, terrain carving and prepared full/compact assets. Inspect matched before/after angles, not different zooms that hide a proportion error.

**Acceptance:** changes satisfy the reference ratios and anchor constraints; inferred values remain labelled approximate even after building approval.

### D03 Parallel walls and connected plan geometry

- Compare true top-down model geometry with aerial evidence. Compute edge bearings, parallel groups and interior angles; do not diagnose geometry from perspective alone.
- Where the building has right-angle construction, validate every connected concave and convex return. Making three balcony fronts parallel is insufficient if neighbouring wall returns remain skewed.
- Preserve intentional setbacks and asymmetry. Fit rounded source coordinates only within documented evidence and precision; retain original coordinates and quantify every moved corner.
- Use the corrected plan consistently in building, roof, foundation, site contact and streaming preparation. Check handedness, normal direction and edge ID mapping after fitting.
- Check stair-to-wall contact against the actual neighbouring wall plane at landing and every tread, including both ends of the overlap. A width check in the stair's own axes cannot catch a tapered gap.
- Re-run the defective plan through the independent check where possible. The Kesk 1 history includes both a parallel-front repair and a later all-corner repair; use the latter as the current state.

**Acceptance:** numeric direction checks and top-down/oblique views agree with the reference; no connected corner or attached assembly remains unchecked.

### D04 Main volumes annexes and canopies

- Establish the annex as its own volume with explicit wall endpoints, roof deck, outer raised wall, end return, parapet and canopy. Do not model a lowered roof behind a tall solid wall as a uniformly tall filled block.
- Check the door's owning wall and orientation. At Kesk 1 it is on the main building side wall, perpendicular to the barred annex end window; this relationship was repeatedly important.
- Check the roof deck's level against the adjacent canopy, overhang depth, support position, end window and façade transition. Avoid duplicate visor/canopy assemblies.
- Verify below-grade closure at the annex without moving its approved above-ground outline. Exposed water/background through the entrance well is a defect.
- Compare plain, vegetation-hidden views from both ends before adding finish. Restore vegetation afterward, preserving the option for clear review views.
- Keep the final proportions and later accepted finish separate in history: acceptance of the annex's shape did not freeze its earlier dark roof edge or pale coping against subsequent instructions.

**Acceptance:** all volume relationships match references in multiple views, and independent dimensions survive targeted edits.

### D05 Elevation and opening schedule

- Reconcile the complete rendered population, not only the clearest sample: expected openings and individual glazed halves versus implemented observed, inferred and deferred layouts, on every floor of every elevation. A handful of detailed units cannot pass the building's window coverage. Flag blank undivided placeholders explicitly when the building's visible window families consistently have bars.
- When the owner explicitly authorizes best guesses for missing views, fill the authorized population with a deterministic, target-supported family and record each inferred unit separately. Preserve directly observed exceptions; do not invent random replacement histories. This exception belongs to that owner's recorded scope and does not authorize guesses for subsequent buildings.


- Give every window/door an ID. Record elevation, floor, horizontal anchor, width, height, sill/head levels, frame material/colour, pane divisions, transoms, curtains, recess and adjacent wall features.
- Count the actual rows/columns and note omissions. Kesk 1's saved rear schedule distinguishes eight central windows, an aligned foundation window and a separate recessed window beneath the balcony.
- Check basement openings independently for height, width, alignment and lintel treatment. Never run the upper-floor pattern through the basement automatically.
- Include blank masonry, narrow staircase openings, offsets and replacements. Preserve observed brown/white/timber differences by unit, not a random seed that invents replacement history.
- Define L1, basement and zero-based array indexing explicitly. A request to move a feature down a floor must be checked against the physical window row, not just a changed index.
- Recount from the final rendered building, with oblique views where recesses hide openings. Compare to the schedule after every change that regenerates a façade.

**Acceptance:** schedule and visible model agree unit by unit, including intentional missing openings and nonuniform floors.

### D06 Windows reveals lintels and sills

- Trace lintels through the wall between openings and across every section boundary. Establish whether they are isolated blocks or connected horizontal courses; record their ends, joints, thickness and projection on each elevation and floor. Check between-window samples as well as directly above windows, including regions partly hidden by trees. Basement treatment remains independent.
- Compare lintel brightness against the adjacent masonry in the same reference plane and model lighting, with shadows disabled as well as enabled. Inspect the combined material tint and texture albedo; a reused stair-concrete recipe is not evidence of the correct lintel colour. Keep independent finish settings where the reference differs.


- Cut the opening in masonry and provide four correctly transformed reveals. Verify depth at all corners and along all four edges; a ray through the window centre cannot check the perimeter.
- Keep glass, frame, reveal, lintel and sill in their intended order and plane. Recessed rear basement reveals must move with the frame; leaving them at the old wall transform creates a detached seam.
- Check frame width, pane layout and believable shadow depth. Do not place a dark rectangle over a missing opening and call it a recess.
- Match lintel width beyond the opening, uniform concrete appearance and flush placement. Kesk 1 required wider uniform lintels and no upper-floor lintels on foundation windows.
- Remove coplanar masonry strips that overlap lintel edges. Use four reveal surfaces instead of a box whose hidden front face crosses the lintel. Inspect the bottom edge while moving the camera in both directions.
- Check sill projection, folded front edge, end contacts and material separately from roof coping. A later roof-metal adjustment must not recolour the sills.
- Inspect oblique sunlight from both directions and shadows disabled; ensure intentional openings and opaque backings behave as intended without light leaking through the surrounding shell.

**Acceptance:** no detached reveal, floating sill, covered lintel, bright perimeter slit or flickering intersection at any inspected opening.

### D07 Balconies by stack and floor

- Record open/enclosed state for each floor in each stack. For Kesk 1, front L7 and rear L2 are open; an older request to enclose front L7 was superseded.
- Open balconies need slab, ceiling, rear wall, door/window and railing with believable interior depth. Do not fill them with invented front glazing or a flat black plane.
- Enclosed units need observed panes, vertical posts, transoms and frame colours. Inspect the lowest timber enclosure, brown replacements and curtains separately from standard white units.
- Keep window/post end faces inside surrounding brickwork where the reference shows this. Inspect both ends on every floor from grazing angles; a thin white line can be an incorrectly projecting frame even when the wall is watertight.
- Model the smooth metal band immediately below the windows separately from corrugated lower cladding. Check band height, continuity, inset and termination; corrugation must not start immediately at the glass if a smooth band intervenes.
- Check panel rib direction, pitch, depth, spacing and scale against close imagery. Prevent ribs clipping through slabs, cheeks, crowns or roof.
- Preserve brick shoulders and side cheeks, slab thicknesses, base recess depth and supporting piers while changing front frames. Keep differences between stacks explicit.

**Acceptance:** every stack has its own complete floor schedule and inspected ends; no blanket “balconies complete” finding based on a single stack.

### D08 Balcony crowns and roof intersections

- Inspect each crown at crown height from frontal, both oblique and overhead views. Ground-level or lower-balcony checks cannot validate the top strip.
- Match upper cladding to the appropriate lower panel material and corrugation. At Kesk 1 all five crowns needed the correction, not only the rear stack.
- Brick ends must continue to their intended roof height; keep pale/white bands inside them rather than bridging through the ends.
- Check shelf depth, roof setback, membrane and parapet together. Eliminate duplicate upward-facing surfaces under the membrane rather than adding a tiny height offset; the earlier 1 mm separation still flickered.
- Retain closed construction geometry for independent audit where needed while exposing only the intended visible roof surface. Inspect outward and inward faces and all rib tips.
- Use small camera increments with shadows on and off, then slow grazing sweeps through the roofline. Check adjacent stacks after modifying a shared generator.

**Acceptance:** matching top bands, continuous masonry ends and a stable roof/crown boundary in motion; no protruding rib tips or material flashes.

### D09 Foundations aprons and ground datum

- Always build the model on a flat foundation. Its top is the model's datum, taken from the atlas ground at the entrances with `entranceDatum` (`src/studio/assembly/seat.ts`), never a fixed study height; its bottom reaches below the lowest ground around the footprint. The foundation absorbs the terrain: it shows more on the downhill side. Do not flatten or grade the ground to the model; only the model's own features (landings, steps, lightwells, sunken entrances) may shape the ground beside it. Mark the override `seatsOnGround`.
- A model written against a fixed study datum can be seated without rewriting it: build it against the ground lowered by the difference (`seatModel`) and raise its root by the same amount, so every ground-relative part still meets the real ground.
- Distinguish wall foundation, below-ground continuation, thin surface apron and a raised structural footing. Kesk 1's initial raised apron blocks were wrong; the reference showed a thin near-flush strip.
- Sample the actual rendered terrain triangles at front/back boundaries and both ends, not just a coarse height at the centre. Keep top faces correctly wound and check all visible side faces.
- Carry full-height wall projections to actual ground even when ground lies below local zero. Check the projection's face and both returns; a base wall behind it does not close its own exposed foot.
- Use identical recess breakpoints above and below datum. A small segment crossing a recess produced the unwanted extra foot at Kesk 1.
- Match supporting foundation piers to the full brick-cheek depth and width. Inspect both ends of each stack and the recessed wall beneath it; no grass or sky should show through a solid support.
- Do not remove a whole cap merely because a neighbouring wall is present. Terrain-dependent lower levels can expose part of it. Subtract only the covered portion and inspect with front-face culling from ordinary and low oblique angles.
- Stop extensions at a clean shared datum. Overlapping extensions and redundant corner patch tops caused thin seams and bright flecks. Do not add another patch to conceal the symptom.
- Avoid grass patches inside the landing/apron footprint. Preserve material classification on small terrain triangles; triangle area alone must not change asphalt into another material.

**Acceptance:** continuous intended wall-to-ground contact across slopes, no protruding feet, hidden holes, overlapping strips or floating apron edges.

### D10 Entrance assemblies and stairs

- Compare the whole entrance bay before inspecting decorative hardware: assembly width, door width/height, exposed brick, render transition, canopy ends and stair direction.
- Check which side is the basement access and which is the main door, which side has stairs, and the observed rail count. Do not mirror a right-only stair or add an extra rail because a generic generator does so.
- Keep door dimensions independent of full-bay canopy/landing width. Kesk 1 needed a smaller door in a full-width assembly, with visible brick and render rising about one-third of the door height above the landing.
- Include supported door glazing, colour, handle, intercom and lighting fixture. Check their mounting and projection at close range.
- Check all tread tops, rises, landings and side contacts. Both front and rear stairs must meet their adjoining walls over the shared depth; do not preserve old side margins after changing the bay geometry.
- Check the bottom riser and stair underside against sloping terrain. Preserve accepted tread elevations while closing ground contacts. Ensure the route is continuous to the existing apron without redesigning the later surroundings phase.
- Inspect canopy-wall joins at both ends, top and underside; flashing and waterproof upstands must meet adjoining brickwork. Verify the overhang support actually touches the canopy and ground/support datum.

**Acceptance:** correct reference proportions and a continuous access assembly, with no grass strip, wedge gap or unexplained bright patch beside the stair.

### D11 Roof structure membrane and folded metal

- Inspect the external roof silhouette from below before an overhead review. Inventory projecting concrete coping, cornice or drip strips separately from the masonry parapet, membrane and metal protection. Record thickness, outward projection, top level, inner edge and all corner/termination relationships. Do not omit a shallow projection because the general roof volume is correct.
- Replace covered upper wall/top faces when forming a continuous cap; check a single visible top owner, outward normals, open roof interior and continuous corners. Probe just outside the old wall plane so a flush former roof edge fails the projection check. Inspect all returns and underside shadow at close range.


- Separate roof deck level, parapet top, coping thickness, drip returns, shelf, raised wall and inner waterproof lining. Never infer one from the apparent height of another.
- Inspect all concave/convex roof corners from inside, outside, above and below. Verify continuous mitres, hole winding and outward normals; lining must remain inside the parapet and not wrap exterior brick corners.
- Check the full-height wall projection through the roof edge; a strip ending below coping is not a complete continuation.
- Keep membrane inboard of external walls. An exposed membrane crossing the annex exterior at deck height produced a false dark horizontal seam; intentional weather staining below coping is a different feature.
- Add folded metal top and downturned edge/profile where supported, including roof projections and exposed canopy edges. A finish sample is not authority for exact fold dimensions.
- Where reference/user instruction requires matching main and annex protection, use the same controlled finish while preserving unrelated metal bands and sills. Kesk 1's current roof-edge finish is muted silver-grey, not the historical dark sill material or brighter balcony-band finish.
- Retain a watertight visible roof surface without duplicate shelf tops. Check the roof under shallow sunlight and at distance, not only overhead.

**Acceptance:** all roof layers have correct boundaries, continuous corners and stable transitions with no red strips, exterior membrane seams or exposed clipping.

### D12 Brick and mortar appearance

- Compare actual unit proportions and bond against a known opening or floor height. Check horizontal and vertical world scale separately so bricks are not stretched around turned walls or small returns.
- Identify bond pattern, mortar colour, joint thickness/depth, chipped edges, irregular courses and occasional raised mortar. Kesk 1's approved larger imperfect brick design must not regress to a tiny uniform grid.
- Use controlled, repeatable variation within observed appearance; random surface grain is different from inventing window layouts or building features.
- Keep colour and relief aligned at chips and joints. Check colour textures with the proper colour space and relief as linear data. Tune physical scale and bump strength together rather than increasing contrast until the wall looks embossed.
- Compare sunlit, shaded and grazing walls at close and medium distance. Check texture repetitions, seams at corners, stretched reveals, speckling and over-dark joints.
- Preserve the approved texture source, version and input files. A higher-resolution or compressed asset must be visually compared; its technical validity does not guarantee the accepted appearance survived.

**Acceptance:** recognisable reference masonry with believable scale and imperfect detail, stable across elevations and zoom levels.

### D13 Roughcast concrete glazing and metal

- Judge material relationships, not only isolated swatches: lintel-to-brick, coping-to-parapet, frame-to-glass and sill-to-frame. Match brightness under comparable light and check texture multiplication does not turn pale concrete into a dark stripe. A roof-edge weathered finish must not silently darken lintel courses or steps.


- Distinguish foundation/annex roughcast, smooth lintel concrete, stair concrete, masonry and sheet metal. Do not assign one generic grey material to all of them.
- Roughcast should show the observed coarse irregular aggregate and broad uneven/wavy trowel relief. Check that it does not become smooth plastic, noisy glitter or oversized rock. Preserve the intended foundation brightness in sun and shade.
- Match the annex to the foundation only where the reference establishes the same finish. Material sameness does not imply identical weathering everywhere.
- Keep lintels uniform when requested; do not let a shared façade texture or bump map run through them.
- Check metal colour, roughness, reflectivity and folds separately. Low gloss must remain low gloss in morning and late sun as well as midday. Shared material changes must not alter accepted fixtures.
- Match glass/frame colour and credible reflection without turning glazing opaque or using glare to hide the interior/opening. Preserve independently evidenced wood/brown/white frames.
- Exercise the texture toggle and ordinary textured view. Plain material mode is a geometry aid and cannot sign off material fidelity.

**Acceptance:** each surface reads as the correct material at its real scale; finish changes remain confined to their intended components.

### D14 Matte felt weathering stains and drying marks

- Inspect main roof, annex roof and front/rear entrance coverings separately, then check requested consistency between them. Do not retain an obsolete black roof simply because an older record called it approved before a superseding change.
- Build the felt's coarse aggregate and smaller grain at appropriate physical scales with separate relief. Fine uncorrelated noise averaged away in Kesk 1 and left a smooth glowing roof despite high roughness.
- Tune albedo brightness, broad mottling, grain contrast, mip filtering and bump strength together. Check sun and shade, close and distant views; higher resolution alone is not an improvement if it erases coarse texture or introduces sparkle.
- Record weathering as a separate layer: location, extent, colour, opacity, softness, direction and source image. Distinguish broad dirt variation, dark water marks, drying puddles and pale drying rims.
- Match the visible main/entrance roof stains and localized annex staining beneath its roof edge. Avoid uniform staining all around an annex where only particular runs are evidenced.
- Keep stains on their owning surface and clipped to its boundary. A stain must not float, shimmer, cross an opening or become a geometry seam. It should modulate the material, not erase aggregate or create an unwarranted glossy standing-water surface.
- Check whether shape and position are approximations. Kesk 1's puddle/drying patterns are appearance approximations, not measured water depths or proof of drainage design.

**Acceptance:** coarse matte surface remains visible beneath plausible, reference-placed weathering without glow, random decorative blotches or motion flicker.

### D15 Vents grilles and rooftop equipment

- Count vents per wall and record spacing, elevation, width/height, recess and relation to roof/floor lines. Kesk 1 has a saved per-edge vent schedule; reuse the practice, not its counts.
- Cut real vent recesses and inspect their lips and backing. A black surface sticker cannot prove depth, and an unclosed vent can leak sunlight through the shell. Check the full band, including corners and nearby brick courses.
- For grilles, trace the entire silhouette: bars, perimeter, cross-members, fan spokes and curved brace. Check terminal spokes all the way to horizontal; the earlier partial quarter-fan was incomplete.
- Confirm the grille sits inside the correct reveal and in front of the frame without clipping the wall. Inspect from both sides and at the lowest visible edge.
- Rooftop housing requires supported placement, orientation, cladding direction, roof edge and visible doors/handles. Kesk 1's centred square lift housing is an explicit approximation, not a generic rule.
- Include the evidenced rear housing door and weather cowl with mounting/base/shaft/cap. Inspect them at their own close-up view; a roof overview cannot prove them present or correctly shaped. Retain uncertain dimensions.

**Acceptance:** complete counts, recesses and silhouettes, correctly mounted; no omitted small parts hidden by the scale of the overview.

### D16 Flower pots boxes and other small attachments

- Inventory flower pots/boxes individually by elevation, floor and window. Record container type, material/colour, length/depth, mounting height and visible plant shape/colour. Do not substitute a generic round pot for an observed rectangular window box.
- Check the floor against the window schedule. Kesk 1 required the flower box to move down one floor; the current implementation places it at the second-floor window. A correct object on the wrong row is still a failure.
- Ensure the container meets its sill, bracket or wall support; inspect both ends, underside and contact shadow. Plant clusters should sit in the container rather than float beside it or penetrate the wall/glass.
- Use only supported fixtures: satellite dish and bracket, pipework, flagpole mount, lights and other small attachments. Record orientation, anchoring, scale and visible silhouette. Avoid adding decorations simply to make the building seem detailed.
- Distinguish a short empty flagpole socket from a pole with a flag. Kesk 1's reference called for the empty socket; adding a flag would have invented a feature.
- Inspect the annex's slender overhang support and short bent ground pipe. Preserve the visible bend and terrain anchoring; do not invent hidden continuation or plumbing function.
- Use close views with lighting on/off and surrounding textures enabled. Small details must remain physically attached and not create exaggerated shadows or z-fighting.

**Acceptance:** correct feature, exact façade/floor relationship and plausible mounting; all observed distinctive items individually accounted for.

### D17 Plaques signs and text

- Preserve local texture coordinates on lettering and labels when applying world-scale UVs to surrounding building surfaces. Inspect actual readable text, not only a correctly placed blank backing.

- Match which wall/corner owns each plaque, order of number/street signs, orientation, text, proportions and spacing. Kesk 1's first placement was beside the wrong window; correct text alone was insufficient.
- Verify text faces outward, remains readable and is not mirrored. Compare frontal and both oblique views.
- Give plaques minimal credible thickness/stand-off, avoiding a projecting block and detached-looking shadow. Kesk 1's later implementation uses approximately 3 mm thickness and 3 mm stand-off as a modelling choice, not a universal dimension.
- Inspect morning/midday/late shadows, sunlit and shaded faces and camera movement. Do not fix an exaggerated plaque shadow by disabling unrelated shadows or putting text coplanar with masonry.

**Acceptance:** correct placement and readable text with subtle contact/shadow and no flicker.

### D18 Lighting and full shadow diagnosis

- Record reproducible viewport, pixel ratio, camera pose/distance, sun setting, shadow-map/quality settings and vegetation state. Preserve original comparison lighting for baseline comparisons; do not compare unlike lighting and call it a geometry regression.
- At morning, midday and late afternoon inspect the complete building shadow across roads, driveway, apron, paths and grass, including its far edge. Bright dashes, tiny holes and window-shaped sunlight inside an opaque building's shadow require explanation.
- Compare each suspect area with shadows off from the same camera. If the line remains, investigate geometry/material overlap, winding and terrain layers. If it changes, inspect shadow casting, receiving, bias and shell closure; do not assume every shadow defect is only a bias setting.
- Test oblique rays through the shell around opening perimeters and near corners. Detached window planes and missing reveal closure admitted sunlight at Kesk 1 even when central rays passed.
- If adjusting bias, inspect both detached shadows and acne across all sun angles/distances. A value that removes one bright patch may create late-light speckling or move contact shadows. Preserve measured context; do not copy Kesk 1's numerical bias to a new camera range without testing.
- Separate visible-face closure from shadow-face treatment. Appropriate double-sided shadow casting is not permission to hide missing visible caps with double-sided material. Ground surface self-shadow handling must not suppress needed building shadows.
- Toggle shadows off/on repeatedly; restore vegetation and check tree/building shadow interaction. Inspect the same contacts while moving, because the right entrance patch reappeared in motion after static views looked clean.

**Acceptance:** no unexplained light leakage, detached shadow, repeating bright holes or acne in the required matrix; no defect concealed by turning a feature off.

### D19 Motion depth and surrounding surface regressions

- Sweep slowly along window/reveal perimeters, wall joins, canopy-wall contacts, datum lines, balcony posts, roof/crown edges and apron/driveway boundaries. Use shallow angles from both directions.
- Test rapid repeated rotation through angle wrap, then settle; test vertical camera limits, overhead views, and zoom from close through compact/full thresholds to town scale and back.
- Record motion or a closely spaced sequence with clear findings. A single stable still cannot establish absence of jitter. State sampled coverage honestly rather than claiming every trajectory is verified.
- Inspect flicker with shadows disabled as well as enabled. Look for duplicate/coplanar faces, material boundaries, near/far depth behaviour and intersecting surface tessellations.
- For shared terrain/surface changes, use common terrain triangulation and intentional category ordering. Independent subdivisions intersected on slopes at Kesk 1's wider atlas review; tiny offsets did not solve the underlying geometry.
- Preserve imported roof facets and silhouettes. Artificial outline strips can intersect survey facets; remove only the diagnosed redundant geometry rather than flattening or simplifying accepted roofs broadly.
- Inspect East/Centre/West and affected neighbouring buildings, including sports-ground/road/grass boundaries, when shared code changes. A clean close-up building can coexist with a broken town view.

**Acceptance:** stable moving view and transitions, no unexplained seams or layer flashes, and no shared-scene regression.

### D20 Runtime resources and independent surroundings

- Before creating assets, search existing textures, materials, details, fittings, fixtures and components under [REUSE.md](REUSE.md). Inspect candidate assets and rendered parts against target references; record search coverage, source paths/versions, exact/near-match classification and unsuitable or uncertain candidates.
- Prefer canonical assets and parameterised components when supported. Keep target layouts/dimensions independent, list every visible difference and variant setting, and justify genuinely new assets. Do not copy files or whole models merely to reuse a small part.
- Include **Reuse and new assets** in every user-facing refinement review, including plain-stage candidates not yet applied. Report retained/applied reuse, new assets, comparison evidence and resource effects; explicitly offer the owner the choice to retain, adjust or replace near matches and record their decisions locally.
- Verify claimed resource savings rather than assuming them: distinguish duplicate source/transfer bytes, shared versus separate texture/geometry allocations, cold/warm loading and draw calls where measured. Mark estimates and unmeasured effects; compare affected consumers when shared assets change.

- Verify the correct building loads by stable ID, survives selection/search/review controls, changes full/compact representation without dropping the existing model prematurely, unloads offscreen and reloads correctly.
- Check material/texture ownership: toggling or disposing one building must not change another building's appearance or dispose a shared texture still in use.
- Check current texture inputs, fallback behavior, original resolution/mips and source hashes. A GPU texture estimate is not total browser memory; compression is not a mobile performance test.
- Test reload, cancelled/in-flight work, relevant retry behaviour and network/console errors. Preserve known limitations in the active local record; do not infer current runtime behavior from an archived incident.
- Check desktop and responsive/touch views without UI obscuring critical details. Record physical iOS/Android testing as unverified until actually measured on those devices.
- Keep platform, paths, street steps, railings, bank and vegetation independently owned where intended. Verify they remain in the atlas when the building unloads or changes detail, not only in an isolated draft.
- Preserve separate rear access, platform, paths and vegetation against their current source and local accepted records. Historical dimensions do not override later instructions. Surroundings work requires its own scope.

**Acceptance:** a complete reuse inventory and user-facing reuse/new-asset summary, explicit owner choices for near matches, correct lifetimes and transitions, documented measured costs and limits, and no lost surroundings or shared-resource regression. Undecided visual approximations remain provisional.
