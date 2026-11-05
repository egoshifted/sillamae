# Building studio

Use the studio to compare building models against the survey and edit street details in the atlas. It runs locally and supports English and Russian.

## Open the studio

With Node.js 24 or newer and the project dependencies installed (`npm ci`), run `npm run studio`. Open [Building studio](http://127.0.0.1:5174/src/studio/) or [Site editor](http://127.0.0.1:5174/src/studio/site/). If the atlas development server is already running, open `/src/studio/` on that server.

## Inspect a building

Search by address or building ID. Compare the original survey, provisional massing and available model stages from repeatable angles. The address bar keeps the camera and display settings, so you can copy it to share a view. The atlas shows the building with its final terrain, vegetation and lighting.

For model authoring, see [Starting a building](NEW-BUILDING.md), the [refinement process](PROCESS.md), [shared components](ASSEMBLY.md) and the [asset library guide](ASSETS.md). The [local checks and capture commands](PROCESS.md#local-checks) cover visual comparisons and review records.

The plan, part editor, saved versions and model connection are covered in [Studio tools](TOOLS.md). They are for inspecting and trying changes; accepted changes go in the building's source.

## Edit a square

Choose a 50, 100 or 200 m square on the map. Select an asset or tree in the palette. Each tool shows its options in the top bar and its shortcuts in the footer.

| Task | Controls |
| --- | --- |
| Select and move | **V** selects. Drag to move, use the orange ring to rotate, or nudge with the arrow keys. |
| Place objects or trees | **A** places one, **P** places a row along a path, and **B** scatters a group. |
| Edit the ground | **U** shapes the terrain. **L** lays a surface and **K** draws a fence, hedge, wall or kerb. |
| Draw roads and paths | **W** draws a street or walking path. Select a drawn route and drag its end handles to extend or shorten it. |
| Hide or remove | **X** hides a survey building. **D** removes objects and trees or clears a section of road or path. Ctrl+Z undoes a stroke. |
| Inspect and navigate | **I** measures. Use **R** to orbit, **H** to pan, **F** to frame the selection and **T** for a plan view. |

**Save** or **Ctrl+S** writes the current square to `data/source/placements/`. You can save several squares before rebuilding. **Reset** returns the square to its state when opened, and Ctrl+Z can undo the reset.

Choose **Update atlas** when you want to see all saved squares in the atlas. Confirm the rebuild, which can take several minutes. You can keep editing while it runs. If you save more changes during the build, choose **Update atlas** again when ready. The footer shows progress and reports failures.
