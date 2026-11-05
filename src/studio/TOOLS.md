# Studio tools

Rules for the plan, part editor, saved versions and model connection, for AI coding agents and people. The code is the source of truth; keep this file short and current. For the building workflow, start with [NEW-BUILDING.md](NEW-BUILDING.md) and [PROCESS.md](PROCESS.md).

## Purpose

- The tools inspect, measure and try changes. They never change the atlas.
- Nothing outside the studio reads `data/source/buildings`. Put every accepted change in the building's source (`design.ts`, `model.ts`) and verify it there.
- A studio edit is an experiment. It is not evidence, a review or an approval.
- Do not commit building records unless the owner asks. `data/source/buildings` is not ignored by Git.

## Views

- **Plan** opens a flat view beside the model: Above, Front, Right, Back or Left, as Textured, Plain, X-ray, Deep x-ray, Lines or Line x-ray. Use it for footprints, setbacks and levels.
- The plan's grid follows the longest footprint edge, so plan axes can differ from world axes.
- **Grid** shows the ground grid. **Toolbox**, **Explorer** and **Hints** show or hide their panels.
- The address bar keeps the building, stage, camera and display settings. Copy it to share a view.
- Set display options in the URL (`light=morning|midday|late`, `shadows`, `textures`, `plain`, `ground` as `true` or `false`) or with `set_view`.

## Part editor

The controls work on every stage. Hints lists the shortcuts for the current selection.

| Task | Controls |
| --- | --- |
| Select | Click. Shift adds, Ctrl removes, Alt+left drag boxes, Ctrl+A selects all, Ctrl+I inverts, Alt+A clears. |
| Move, rotate, scale | Drag the gizmo. G, R and S switch mode. |
| Copy or delete | Shift+D duplicates. Del, Backspace or X deletes. |
| Hide or lock | H hides, Alt+H shows all hidden parts, L locks or unlocks. |
| Group | Ctrl+G groups, Ctrl+Shift+G ungroups, F2 renames a group or element. |
| History | Ctrl+Z undoes. Ctrl+Shift+Z or Ctrl+Y redoes. The History list jumps to any step. |
| Describe | Ctrl+C copies a text description of the selection. Right click opens the actions menu. |
| Camera | Middle drag orbits, Shift+middle pans, the wheel zooms, W A S D walk. |

- Right click in the Explorer to create a layer or an element. An element is a plain 1 m box for trying a size or position.
- A batched mesh is one part. Selecting it selects the whole batch.

## Saving

- **File > Export** downloads a version as JSON. **File > Import** restores it, including its history, for the same building.
- The model connection's `save` writes `data/source/buildings/<id>.json`. The studio loads that file when the building opens.
- Placed toolbox items and history return only through Import. A reload applies part edits alone.
- A saved record also applies in `studio:capture`. Remove or set aside the record before capturing review evidence.

## Part IDs

- Saved edits find their part by ID. A generator can set `userData.id`; other objects get a path through the model, such as `model/front/detail-batch#2`.
- Name meshes and groups in generators. Named paths are readable and survive changes to their neighbours.
- IDs must be repeatable: the same source must give the same IDs on every build. Number per build, never in a module-level counter.
- Renaming, reordering or restructuring a model invalidates its saved edits. Kesk 1 IDs contain source line numbers, so any line shift does too.
- The status bar reports edits whose part is gone as **Saved edits not applied**. An ID that now belongs to a different part still applies silently, so re-check saved edits after changing a model.
- To edit single parts of a batched model, emit separate meshes when `scene.userData.keepParts` is set, as the Kesk 1 generator does. The studio sets it; the atlas keeps batching.

## Design records

- `src/studio/editables.ts` lists buildings whose design record rebuilds through their real generator. Add a building by giving it a `source` record and a `build` factory.
- The record's panel (`#inspector`) is hidden in the current studio, so its fields, **Save record** and **Download PNG** cannot be reached. To try a design value, edit `design` in an exported file and Import it on the assembled stage.

## Model connection

The dev server exposes an MCP endpoint at `/__studio/mcp` (port 5174 with `npm run studio`). It does not exist in a production build.

```bash
claude mcp add --transport http sillamae-studio http://127.0.0.1:5174/__studio/mcp
```

1. Open the studio tab on the building and stage. The connection cannot change either.
2. Connect the client. The **MCP** menu shows the status and enabled channels.
3. Call `configure`. Only `identity` and `selection` can be read by default, and only `select` can be written.
4. Query or experiment, then put the result in source.

| Tool | Needs | Use |
| --- | --- | --- |
| `configure` | | Enable `read` channels and `write` actions; set `fields` and `limit`. |
| `look` | | Read every enabled channel: `identity`, `selection`, `tree`, `camera`, `view`, `cost`, `history`, `edits`, `toolbox`. |
| `find` | | Search by `name`, `material`, `locked`, `selected` or `ids`. Follow `cursor` for more pages. |
| `select` | `select` | Select parts. |
| `hide`, `show` | `visibility` | Change visibility. |
| `lock`, `unlock` | `lock` | Change locks. |
| `group`, `ungroup` | `group` | Change groups. |
| `pose` | `transform` | Move, rotate or scale. Locked parts are skipped. |
| `place` | `place` | Place a toolbox item. |
| `set_camera`, `set_view` | `camera`, `view` | Change the camera, light, materials, ground, grid, plan or gizmo. |
| `undo`, `redo` | `history` | Step through history. |
| `save` | `save` | Write the building record. |

- Enable only the channels and actions the task needs. They limit what a client sees and does by mistake; they are not a security boundary, because a client can enable them itself.
- `pose` uses coordinates relative to the part's parent. `bounds` uses viewer coordinates. Read `pose` before writing it.
- `find` by material needs named materials. Name them in the generator.
- There are no tools for screenshots, design values, deleting parts or changing building. Use captures or a browser to see the result.
- One client and one tab connect at a time. A newer studio tab takes the session; a capture page does not. A second client is refused until the first has been idle for 30 s.
- Channel settings stay after a client leaves. **Disconnect** then **Connect** resets them.

## Toolbox

- Add an item as a file in `toolbox/items/` and a line in `toolbox/items/index.ts`. Keep the origin on the surface, with +z facing away from it.
- Toolbox items are study props. Library assets follow [ASSETS.md](ASSETS.md) and [REUSE.md](REUSE.md).

## Checks

- Tool changes follow the [local checks](PROCESS.md#local-checks). `npm test` covers versions, IDs and the connection.
- Exercise saving in a real studio. A record must survive a page reload: moved parts in place, duplicates as copies, no stand-in boxes.
- Delete test records from `data/source/buildings` afterwards.
