# Usage recipes

Shapes that work. Every one starts by picking a Studio.

## 1. Pick a target

```json
{ "name": "list_roblox_studios", "arguments": {} }
```

Answer:

```
6d0d0600-2b41-4047-9dd4-9026518d76b8 — (unnamed)
9f2b6062-e673-4d67-b87c-2ea46624cd50 — MyPlace (placeId: 124737029844776)
```

Keep that id and pass it as `studio_id` on everything below.

## 2. Find out where you are

```json
{ "name": "execute_luau",
  "arguments": { "studio_id": "<id>", "datamodel_type": "Edit",
                 "code": "return game.PlaceId .. ' | ' .. #game:GetDescendants()" } }
```

`datamodel_type` is `Edit`, `Client` or `Server`. `Client` and `Server` only exist in play
mode.

## 3. Read several scripts

```json
{ "name": "script_read_many",
  "arguments": { "studio_id": "<id>",
                 "paths": ["game.ServerScriptService.Main", "game.ReplicatedStorage.Shared.Util"] } }
```

Each script comes back under its own heading; a bad path reports itself.

## 4. A batched write

Studio freezes while the chunk runs. Build outside the tree, parent once, wait once:

```lua
local folder = Instance.new("Folder")
folder.Name = "Generated"
for i = 1, 200 do
  local part = Instance.new("Part")
  part.Position = Vector3.new(i * 4, 5, 0)
  part.Parent = folder
end
folder.Parent = workspace
task.wait()
return #folder:GetChildren()
```

## 5. Bulk edit with a yield

```lua
local roots = workspace:GetDescendants()
local changed = 0
for index, item in roots do
  if item:IsA("BasePart") then
    item.Anchored = true
    changed += 1
  end
  if index % 1000 == 0 then task.wait() end
end
return changed
```

## 6. Screenshot the viewport

```json
{ "name": "screen_capture",
  "arguments": { "studio_id": "<id>", "capture_id": "ScreenCapture_1" } }
```

Or point the camera first with `camera_position` and `look_at_position`.

## 7. Run a test in play mode

1. `start_stop_play` with `is_start: true`.
2. Wait for `get_studio_state` to report `Client`/`Server`.
3. `user_keyboard_input` / `execute_luau` against the `Client` datamodel.
4. `start_stop_play` with `is_start: false`.

## 8. Long generation

```json
{ "name": "generate_procedural_model", "arguments": { "studio_id": "<id>", "prompt": "a lamp post", "async": true } }
```

`async: true` returns a job id at once; `wait_job_finished` blocks on it later.

## Habits

- Save before a bulk run.
- One `studio_id` per logical task; re-list if the place reloads.
- Prefer one batched `execute_luau` over fifty small ones.
- Return a count or a short string, not a whole tree.
