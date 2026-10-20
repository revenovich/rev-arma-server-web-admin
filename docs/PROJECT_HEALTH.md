# Project health: problems, risks and upgrade candidates

Audit of `master` @ `6485de8` (2026-10-16). Every item below was traced in code; items marked **✔ reproduced** were also confirmed by running the code (TestClient probe, test suite, linters). Line numbers are as of that commit.

_Update: the CI failures in §3 have since been fixed. CI's checks now pass on Linux. The path-traversal holes S0, S1, S6 and S7 and the P12 rename failure are also fixed (marked **✅ Fixed** in place). Everything else is as audited._

## TL;DR

The rewrite has a sound architecture and good unit-test coverage, but **several headline features don't work end-to-end**, and there are **path-traversal holes that let a request delete or write files outside their directories**:

1. **Security:** ✅ *Fixed:* `POST /api/presets/update-mods` could be steered into deleting files across the game install (S0), mission upload wrote outside `mpmissions` (S1), and file names in the Caddy listing could write outside the mod folder (S7). *Still open:* auth is off by default and silently stays off when the app is started from another directory (S2).
2. **Servers can't be run reliably:**
   - stdout is piped but never read, so the server blocks once the pipe fills (P5).
   - ~~The A2S status query targets the wrong port, so servers show offline, headless clients never start, and the UI never offers **Stop** (P4, P13).~~ **Fixed.**
   - `stop()` crashes on Python 3.9 (P6).
3. **Editing doesn't work:**
   - Six of the seven server-detail tabs can't save (P1).
   - Most of the fields they edit never reach `server.cfg`, `basic.cfg` or the profile (P2).
   - Mission rotation writes `.pbo` into `template` (P14).
4. **Data loss:**
   - Duplicate titles and clones overwrite servers (P7).
   - Switching servers saves A's form onto B (P8).
   - One invalid record in `servers.json` drops every record after it on the next save (P19).
5. **Live updates:** WebSocket "servers" events wipe the UI's server list instead of refreshing it (P3).
6. ~~**CI on Linux:** ruff (118 errors, 96 of them intentional schema names), one Windows-only-passing test, and two ESLint errors.~~ **Fixed** (§3).

Unit tests mock both sides of each contract (frontend tests mock `api`, E2E mocks every `/api/**` route), which is why the suites are green while the integrated app is broken. Contract-level tests are the biggest missing piece.

---

## 1. Current problems (broken behaviour)

### P1 — Server-detail tabs can't save (✔ reproduced)
`PUT /api/servers/{id}` returns **400 "Server title cannot be empty"** unless the body includes `title` (`app/api/servers.py:55`). Only `GeneralTab` sends `title`. `MissionsTab`, `ModsTab`, `DifficultyTab`, `NetworkTab`, `SecurityTab` and `AdvancedTab` all send partial payloads, so each save shows "Failed to update server" and nothing is persisted.
*Fix:* treat `PUT` as a merge (drop the title check when `title` is absent) or add `PATCH`; add an integration test that does a partial update.

### P2 — Most tab fields never reach an Arma config file
Even after P1 is fixed, these values would only end up as extra keys in `servers.json`:
- `write_server_cfg` (`app/domain/config_writer/server_config.py`) writes about 15 keys. Everything from Network/Security/Missions (`kickDuplicate`, `loopback`, `upnp`, `MaxPing`, `MaxPacketLoss`, `MaxDesync`, `DisconnectTimeout`, `serverCommandPassword`, `filePatchingExceptions`, `allowedLoadFileExtensions`, `autoSelectMission`, `randomMissionOrder`, …) is ignored. `app/schemas/server_config.py` already defines the full schema, but nothing uses it.
- `write_basic_cfg` is always called with defaults (`server.py:260`), and the file is shared by every server. `-cfg=` is never passed, so Arma doesn't load it anyway.
- `write_profile_cfg` is always called with defaults. `DifficultyTab` only sends `forcedDifficulty` and drops its flag toggles. The profile is written to `<path>/<id>.Arma3Profile`, but `-profiles=`/`-name=` are never passed, so Arma won't find it.
*Fix:* drive all three writers from the stored server record, pass `-cfg`, `-profiles`, `-name`, and add golden-file tests per tab.

### P3 — WebSocket "servers" events wipe the UI's server list (✔ reproduced)
Every backend publisher sends `{"type": "servers", "payload": null}` as a "changed" signal (`servers.py:37,60,72,122`, `server.py:179,203,216`). `useServerStatus` (`frontend/src/hooks/useServerStatus.ts:20`) treats the payload as the new list and does `setQueryData(["servers"], null)`. The Overview then flips to "No servers yet" on every create/update/delete/start/stop, and **every 5 s while any server is running**. The `server` / `server_state` handlers it also implements are never sent by the backend.
*Fix:* pick one contract. Either publish `[s.to_json() for s in manager.servers]`, or have the client `invalidateQueries` on a null payload. Add a test that runs the real backend envelope through the hook.

### ~~P4 — A2S status probably never succeeds, so headless clients never start~~ ✅ Fixed
~~`_poll_status` queries `127.0.0.1:<game port>` (`server.py:212`, `services/a2s.py:16`). Arma 3 answers Steam queries on **game port + 1**; the Node app's Gamedig query applied that offset automatically. Expect `state` to stay `None`, the UI to show "offline" for running servers, and `_start_hc()` never to run, because it's gated on a successful query. The `game` argument to `query_status` is unused. *Verify against a live server*, then apply the per-game query-port offset.~~
**Fixed:** `services/a2s.py` `query_port()` adds the per-game offset (game port + 1 for Arma 2, Arma 2 OA and Arma 3). Arma 1, OFP and CWA answer only GameSpy, not A2S, so they still show offline. Tests: `test_query_status_reaches_arma3_on_game_port_plus_one` (real UDP round trip against a fake A2S responder) and `test_query_port_offset_per_game`. Still not checked against a live server.

### P5 — Server stdout is piped but never read
`Server.start()` uses `stdout=PIPE, stderr=STDOUT` (`server.py:157`), but nothing reads it. Once the OS pipe buffer fills (about 64 KB on Linux), the server process blocks on write. Arma on Linux logs to stdout, so this is likely within minutes of a busy session. A related gap: the old Node app wrote this stream to `<path>/logs/*.rpt` and pruned it to 20 files. Here `cleanup_old_logs()` is never called, so **the Logs screen is empty on Linux**.
*Fix:* drain stdout in a task, write it to a rotating `.rpt` in `logs_dir`, optionally fan it out over the bus (that also gives you a live console, see §5).

### P6 — `stop()` raises instead of killing on Python 3.9/3.10
`server.py:188` catches only builtin `TimeoutError`. Before 3.11, `asyncio.wait_for` raises `asyncio.TimeoutError`, so a server that ignores SIGTERM for 5 s causes a 500 and is never killed. Headless clients are also left running. This is the same class of bug that was already fixed in `ws.py`.

### P7 — Duplicate titles silently overwrite servers (✔ reproduced)
`id = slugify(title)` and `Manager.add` doesn't check for collisions (`manager.py:30`). Creating a second "My Server", or pressing **Clone** twice ("Copy of X" both times), replaces the first entry in memory and in `servers.json`. Renaming one server to another's title in `Manager.update` has the same effect.

### P8 — Renaming a server breaks the detail page; switching servers keeps stale form state
- A rename on GeneralTab changes the id, but the page stays on `/servers/<old-id>/…` and shows "Failed to load server". It needs a `navigate()` to the new id.
- The tab components stay mounted when the `:id` param changes (React Router reuses the element). `GeneralTab` only resets the form when `title === ""`, and the other tabs only reset when `!initialized`. Going from server A to server B in the sidebar shows **A's values on B's page**, and Save writes them to B. Fix with `key={id}` on the `<Outlet/>`, or reset on id change.

### P9 — Updates bypass validation (✔ reproduced)
`Server.update()` uses `model_copy(update=data)` (`server.py:93`), which skips pydantic validation. `PUT {"port": "not-a-number", "max_players": "lots"}` returns 200, is persisted, and would be written as `maxPlayers = lots;` / `-port=not-a-number`. Use `ServerSchema.model_validate({**old.model_dump(), **data})`.

### P10 — `server.cfg` writer produces invalid or wrong output (✔ reproduced)
- No escaping. A `"` in hostname, password, MOTD or a mission name ends the string (`hostname = "My "Best" Server";`). Arma escapes `"` as `""`. MOTD lines can inject arbitrary cfg entries.
- `allowedFilePatching = {allowed_file_patching or 1}`: a stored `0` is written as `1`.
- Per-mission params are emitted directly inside `class Mission_N` (`        foo = 1;`). Arma expects them inside `class Params { … };`, so it ignores them.

### P11 — `/api/auth` and `require_auth` disagree when only one credential is set
`require_auth` is disabled only when **both** username and password are empty (`app/api/__init__.py:32`). `/api/auth` reports `auth_required` only when **both** are set (`app/api/auth.py:14`). With just one set, the UI skips the login screen and every call returns 401.

### P12 — Mission upload fails across filesystems (✅ rename fixed)
✅ **Fixed:** `save_upload` now uses `shutil.move`, which falls back to copy + delete across filesystems or drives. *Still open:* the whole upload is read into memory.

Original finding: `upload_missions` writes to the system temp dir, then `Path.rename()`s into `mpmissions` (`app/domain/missions.py:57`). `rename` fails with `EXDEV` / `WinError 17` when temp and the game dir are on different filesystems or drives, which is the README's own Windows example (`D:\Arma3Server`). Use `shutil.move` or a temp file inside the destination dir. The whole upload is also read into memory (up to 512 MB × 64 files).

### ~~P13 — No Stop button for a running server~~ ✅ Fixed
~~`ServerDetailScreen.tsx:55` and `ServerCard.tsx:15` decide online/offline, and Start vs Stop, from `state.online` (A2S) instead of `pid`. Combined with P3 and P4, a started server keeps showing **Start**. Pressing it again just returns `already_running`, so the UI has no way to stop the server. Base the button on `pid != null` and the status dot on `state`.~~
**Fixed:** Start/Stop now follow `pid != null` and the status dot follows `state.online`, in both `ServerCard` and `ServerDetailScreen`. A started server shows **Stop** with an offline dot until it answers A2S. P3 still means the list only refreshes on refetch, not on WS events.

### P14 — Mission rotation and missions migrated from the Node app write the wrong `template`
- `MissionsTab.tsx:332` adds `m.name`, the full filename (`co10.Altis.pbo`). Arma expects `template = "co10.Altis";` with no `.pbo`, which is what the backend golden test (`tests/backend/unit/test_config_writer.py:138`) asserts.
- Missions saved by the old Node app are `{"name": "co10.Altis", ...}`. `write_server_cfg` reads only `template` and emits `template = "";`. `parseMissions` shows them as `[object Object]`. This contradicts the README's promise that "servers.json works as-is".

### P15 — SteamCMD screen is non-functional (✔ reproduced)
- `POST /steamcmd/install` and `POST /steamcmd/update` are sent with no body, but the routes require a JSON body, so both return **422** (`SteamCmdScreen.tsx:23,28` vs `app/api/steamcmd.py:20,34`).
- None of the three mutations has an `onError`, and a `{ok: false, error}` reply comes back as 200, so failures are invisible.
- The "Installed" badge reads an `installed` field the API never returns.
- The streamed `steamcmd` WS events are ignored.

### P16 — Workshop mission import is unreachable (✔ reproduced)
`useMissions.ts:46` posts to `/missions/workshop/` (trailing slash), but the route is `/api/missions/workshop`, so the call gets 405. No screen uses the hook anyway.

### P17 — Auth UX failure modes
- Nothing handles 401 by logging out. After a password change, every screen shows "Failed to load…".
- Meanwhile `ws.ts` keeps reconnecting with the stale token. Each attempt counts as a failure in the shared per-IP counter (`app/api/ws.py:71`), so after about 5 reconnects the user's own IP is **locked out of the login form** (429).
- Logout doesn't clear the query cache.
- Mission and log downloads are plain `<a href>` links (`MissionsScreen.tsx:97`, `LogsScreen.tsx:62`) that carry no `Authorization` header. With auth enabled they trigger the browser's native Basic prompt or fail. Filenames in those URLs aren't `encodeURIComponent`-ed.

### P18 — Dead or placeholder UI
- The Mods "Delete" button has no handler, and there's no backend endpoint for it (`ModsScreen.tsx:52`).
- Presets "Load" is a `TODO` (`PresetsScreen.tsx:84`).
- `/presets/:id` and 404 are placeholders (`router.tsx:20-34`).
- 13 of the 16 preset endpoints have no UI: `comparison`, `compare`, `fetch`, `link-status`, `link`, `unlink`, `migrate`, `clean-orphans`, `missing-report`, `sync-missing`, `update-mods`, `check-names`, `GET /{name}`.
- So do `GET /servers/{id}/config/defaults` and log "view" mode.
- The preset types in `src/types/api.ts:209-235` don't match `app/schemas/preset.py`.

### P19 — One bad record in `servers.json` can wipe the others
`Manager.load()` wraps the *whole* loop in one `try` (`manager.py:69-79`). The first record that fails validation stops loading, so every later record is skipped. The next `save()` (any create/update/delete) then rewrites the file with only the records that loaded. P9 makes it easy to persist such a record. The write itself is a non-atomic `write_text`, so a crash mid-write truncates the file.
*Fix:* validate each record on its own and skip-and-log failures, keep a `.bak` before writing, and write to a temp file then `os.replace`.

### P20 — Preset pipeline is unreliable end-to-end (traced in code, not run against a real Caddy)
- `/api/presets/fetch` always fails with a 500. Its progress callback calls `request.app.state.loop.create_task(...)` (`presets.py:124`), but `app.state.loop` is never set. No test covers it.
- Preset identity: the name comes from `<title>`, which is always "Arma 3" in Launcher exports; the real name is in `<meta name="arma:PresetName">`. `source_file` is the random temp filename (`preset_parser.py:65-72`). Two uploaded presets therefore collide in `comparison.unique[...]`, and re-uploading one creates a duplicate.
- Folder naming disagrees between steps:
  - `/fetch` names folders after the display name without `@` (`presets.py:138`).
  - `/link` only considers `@`-prefixed folders (`mod_linker.py:65`).
  - `clean-orphans` compares lowercased display names with folder names (`mod_cleaner.py:25-47`), so a mod that is still in use but named differently (`@CUP_Terrains_Core` vs "CUP Terrains - Core") gets `rmtree`'d.
- ~~`update-mods` deletes local files the server listing doesn't contain. If Caddy's JSON listing returns directory names with a trailing `/` (which `_folder_url`'s stripping suggests), `_walk` builds keys like `addons//x.pbo`, nothing matches, and every file in a subfolder is deleted after downloading.~~ **✅ Fixed with S7.** Caddy's `browsetplcontext.go` does append `/` to directory names. `_walk` now strips that slash before validating the name, so keys are `addons/x.pbo`. Test: `test_update_mod_folder_keeps_subfolder_files_from_caddy_listing`. The rest of the pipeline still hasn't been run against a real Caddy.
- `/fetch` and `/sync-missing` stop at the first mod that fails: a rejected listing (S7, 502), a Caddy HTTP error or a failed download. The response then reports nothing for the mods before it, although their files stay on disk, and the mods after it are never tried. *Fix:* catch errors per mod in both loops, record `{"mod": …, "status": "error", "detail": …}` in `results`, and carry on.

### P21 — Launch arguments: server-side mods and branches
- `config.serverMods` is prepended to `-mod=` (`server.py:126-129`) instead of being passed as `-serverMod=`, so "server-only" mods are required of every client.
- SteamCMD branch switching does nothing: `+app_update_beta <branch>` is not a SteamCMD command (`services/steamcmd.py:38`). The correct form is `+app_update <id> -beta <branch> validate`. `/steamcmd/branch` is identical to `/update`, and the request body's `path` silently overrides the install directory.

### P22 — `python -m app.main` always runs with `reload=True`
`main.py:130`. In production, any `.py` change or `git pull` restarts the worker, and the lifespan shutdown **stops every running Arma server**. On Windows, uvicorn's reload mode uses a `SelectorEventLoop` regardless of the policy set at `main.py:15`, so server start fails with `NotImplementedError` in that mode.

### P23 — `PUT /api/servers/{id}/config` renames without re-keying (500)
`update_server_config` (`servers.py:118`) calls `server.update(body)` directly, bypassing `Manager.update`. If `title` changes, the manager's dict key stays old: `GET /<new-id>` returns 404, and a later `PUT /<old-id>` crashes with a `KeyError` at `manager.py:48`.

## 2. Potential issues (latent bugs, security, platform)

### Security

| # | Severity | Issue |
|---|---|---|
| S0 | **Critical** | **✅ Fixed.** Every preset path join now goes through `app.core.paths.safe_join`. It rejects `/`, `\`, `.`/`..`, NUL, empty names and drive/absolute prefixes, then requires the resolved path to be strictly inside `downloads/` (`is_relative_to`). This covers `/update-mods`, `/fetch`, `/sync-missing`, `/link`, `/unlink` and `mod_migrator`. Bad names return 400 before Caddy is contacted or anything on disk changes. Tests: `tests/backend/integration/test_api_presets.py`. *Original finding:* **`POST /api/presets/update-mods` can delete files across the game install (✔ reproduced up to path resolution).** `mod` and `group` from the request body are joined into `downloads/<group>/<mod>` (`presets.py:276-289`). `_normalize_name("@ace/../../..")` is `ace`, so a real `@ace` folder on the Caddy server matches, and the destination resolves to the **game directory itself**. `mod_updater.update_mod_folder` then unlinks every local file not in that mod's listing (`mod_updater.py:63-74`). The same traversal applies to `group` and to preset/mod names in `/fetch`, `/link`, `/unlink`, `/migrate` (`presets.py:138,179,189,259`, `mod_migrator.py:119`). Fix: validate names against `^[@\w .-]+$`, resolve paths, and require `is_relative_to(downloads)`. |
| S1 | High | **✅ Fixed.** `save_upload` keeps only the last path component of the upload filename (either separator style), then joins it with `safe_join`. A resolved path outside `mpmissions` (e.g. through a symlink) returns 400. Tests: `tests/backend/integration/test_api_missions.py`. *Original finding:* **Path traversal on mission upload (✔ reproduced).** `save_upload` joins the client-supplied filename onto `mpmissions` without sanitising it (`app/domain/missions.py:55`). An upload named `../../escaped.pbo` is written two directories above `mpmissions`. The `.pbo` suffix is the only constraint. Fix: `Path(filename).name`, then verify `resolved.is_relative_to(base)`. |
| S2 | High | **Auth fails open.** `config.json.example` ships with empty credentials and `host: 0.0.0.0`, so every route is open on the network: start/stop, SteamCMD, file writes, and the preset operations that delete folders. `config.json` is resolved relative to the **CWD** (`core/config.py:62`). A service started from another directory (systemd without `WorkingDirectory`, nssm without `AppDirectory`) silently finds no config and runs **with auth disabled**. Fix: resolve config relative to the project or an explicit `--config`, log a loud warning, and refuse a non-loopback `host` without credentials. |
| S3 | Medium | **Credentials leak into logs and storage.** The browser sends `?token=base64(user:pass)` on the WS URL, and uvicorn's access log prints the full query string for every WS connect. The UI also keeps `{username, password}` as plaintext JSON in `sessionStorage` (`useAuth.tsx:79`). |
| S4 | Medium | **`server.cfg` injection.** No escaping in `write_server_cfg` (P10), so anyone who can edit a server can inject arbitrary `server.cfg` directives through MOTD/hostname. Low risk if only admins have access, but it also breaks benign input containing `"`. |
| S5 | Medium | **The brute-force lockout is weak.** It's per-IP and in-memory, and the counter dicts grow without bound (one entry per IP). Behind a reverse proxy every client shares one IP, so one attacker locks out everyone. The WS path increments the same counter on every reconnect (P17). |
| S6 | Low | **✅ Fixed.** Download and delete resolve the filename through `missions.mission_path` → `safe_join`. That rejects separators and `..` in the URL segment and uses `Path.is_relative_to` instead of a string prefix. Both return 400. *Original finding:* **Path-prefix check.** `download_mission`/`delete_mission` use `str(path).startswith(str(base))` (`app/api/missions.py:64,79`), which also accepts a sibling such as `mpmissions_old\`. On Windows a single URL path segment can carry `..\mpmissions_old\x.pbo`, so the sibling is reachable there. Use `Path.is_relative_to`. |
| S7 | High | **✅ Fixed.** `mod_fetcher._walk` passes every listing name through `validate_name` (after stripping the `/` Caddy appends to directory names). One unsafe name raises `UnsafeListingError` for the whole folder, with a structlog warning, before anything is downloaded or removed. The request returns 502, since the file server is at fault, not the request. `UnsafeListingError` subclasses `UnsafePathError`, so existing handlers still catch it. Entries are rejected rather than skipped because `update_mod_folder` removes local files that a filtered listing would leave out. `download_mod_folder` and `update_mod_folder` also check every target with `ensure_within(dest_path, …)` up front, which catches a symlink inside the mod folder that points out of it. Tests: `tests/backend/unit/test_mod_fetcher.py`, `test_mod_updater.py` (Caddy mocked with `respx`) and `test_update_mods_rejects_unsafe_caddy_listing`. *Original finding:* **Caddy listing names were trusted (✔ reproduced).** `_walk` built relative paths from `item["name"]` unchecked, and `download_mod_folder`/`update_mod_folder` wrote to `dest_path / rel_path`. A listing entry `../evil.txt` (or one containing `\`, or an absolute/drive path) was written outside the mod folder. A compromised or misconfigured file server could drop files such as DLLs anywhere the app can write. The removal pass only walks `dest_path.rglob`, so it stayed inside the folder. |

Also on the security side:
- **Request bodies are parsed before `require_auth` runs, with no size limits.** Unauthenticated clients can make the app buffer large JSON bodies or spool large multipart uploads to disk. Put a body-size limit in front (reverse proxy or middleware).
- **Passwords are broadcast.** `Server.to_json()` includes `password` and `admin_password`, so they go out in every `GET /api/servers/` response and in the WS snapshot to every connected client.
- **`/api/docs`, `/api/redoc` and `/api/openapi.json` are unauthenticated.** They expose the full API surface.

### Latent bugs and robustness

- **Double-start race.** `start()` checks `self._process is None`, then `await`s config writing and spawning. Two quick clicks can spawn two processes, and the first one is orphaned (`server.py:142-155`).
- **Headless clients** are only `terminate()`d, never awaited or killed, and are never restarted if they crash.
- **A failed start reports success.** `POST /start` returns `{"status": "ok", "pid": null}` when the spawn failed (`servers.py:84`).
- **WS connect blocks the event loop.** Every new connection runs the synchronous `list_mods()` (recursive globs plus a size walk per mod over the game dir) inside `_send_initial_snapshot` (`ws.py:122`). Use `asyncio.to_thread`.
- **Log timestamps are float strings.** `created`/`modified` are produced by `stat().st_ctime.__format__("")`, sorted as strings and shown raw in the UI (`domain/logs.py:33-43`). Return ISO datetimes like missions do.
- **The Wine log path uses the Windows XP layout** (`Local Settings/Application Data`) instead of `AppData/Local` (`paths.py:47-56`).
- **Bad titles produce empty ids.** A title like `"!!!"` slugifies to `""`, an empty server id.
- **Workshop mission download is unlikely to work.** It relies on `file_url` from `GetPublishedFileDetails`, which is normally empty for Arma workshop items. It needs SteamCMD `workshop_download_item`.
- **`scripts/migrate_servers_json.py` barely migrates anything.** `migrate_entry` only fills in title/port. Several untitled entries all become "Unnamed Server" (one slug), duplicate slugs aren't checked, and there is no backup. It also doesn't convert Node-style `{name}` missions (P14).
- **Windows-only test.** `test_mod_linker.py` junction tests skip on Linux, so the most dangerous code path (junction vs `rmtree`) is only exercised on a developer's Windows machine. Consider a `windows-latest` CI job.
- **Unused code:** `schemas/server_config.py`, `BANDWIDTH_PRESETS`, `QUERY_TYPES`, `list_mod_updates`, `parse_modlist_dir`, the `game` argument of `query_status`, and the `aiofiles` dependency. Wire them in or delete them so the code reflects what's real.

## 3. Tooling, CI and test health

**CI failed on every one of its 38 runs up to `6485de8` (run #38).** The blocking failures are now fixed, and every CI step passes locally on Linux with the versions CI uses (Python 3.13, Node 22, latest ruff):

| Check | Result on Linux | Cause / fix |
|---|---|---|
| `ruff check app/ tests/` | **Pass** (was 118 errors) | **Fixed.** 96× `N815` were the *intentional* camelCase schema fields (servers.json parity), so `pyproject.toml` now has `"app/schemas/**" = ["N815"]` under `per-file-ignores`. The other 22 were real: 21 auto-fixed import/EOF-newline errors, plus 1× `N806` (`_MAX_FILE_SIZE` inside `upload_missions`, now a module constant). |
| `pytest` | **Pass**: 338 passed, 3 skipped (was 1 failed) | **Fixed.** `mod_fetcher.list_mod_updates` only mapped `/`→`os.sep`, so on Linux a server path `subdir\file.bisign` was treated as a literal filename and always reported stale. It now normalises `\` to `/` before joining, as `download_mod_folder` already did. The function is still **not called by any route** (`update-mods` uses `mod_updater.update_mod_folder`); see "Unused code" in §2. |
| Coverage | 83.36% (gate 80%) | OK |
| `mypy app/` | 19 errors (non-blocking in CI) | Mostly `Returning Any` from `request.app.state`. Also real type bugs: `missions.py:44-45` passes a `float` where the schema wants `datetime`, and `mod_reporter.py:28,39` has a `PresetGroup` vs `str` mismatch. Recent mypy also rejects `python_version = "3.9"` in `pyproject.toml`. |
| `npm run lint` | **0 errors**, 1 warning (was 2 errors) | **Fixed.** `react-refresh/only-export-components`: `useAuth.tsx` exported both the provider and the hook. It is now split into `AuthProvider.tsx`, `useAuth.ts` and `auth-context.ts`. `react-hooks/globals`: `useAuth.test.tsx` assigned an outer variable during render, and now uses `renderHook`. The remaining warning (non-blocking) is `react-hooks/incompatible-library` on RHF `watch()` in `GeneralTab`. |
| `npm run typecheck` / `vitest` / `build` | Pass: 459 tests, 32 files, 85.98% line coverage | CI's test step was also broken, though nobody noticed because lint failed first: `--coverage-reporter=text` is not a Vitest 4 option. It is now `--coverage.reporter=text`. The main bundle is 852 KB raw / **255 KB gzip (`gzip -c`, as CI measures it), 83% of the 300 KB gate**. There's no code-splitting. |
| `npm audit` | 34 vulns (1 critical, 18 high) | Almost all come through the `shadcn` CLI being a runtime `dependency` (it pulls in MCP SDK, hono, ts-morph, undici, etc.). Moving it to `devDependencies` and running `npm audit fix` clears most of them. The rest are direct dev-tool deps (`vite` 8.0.8 Windows advisories, `postcss`). |
| Playwright E2E | Not run in CI | All 36 snapshots are `*-chromium-win32.png` and fail as "missing" on Linux. Several specs still navigate to the removed `/info` tab and expect "Info"/"Headless" tabs. `missions.spec.ts:40` mocks `/api/missions` without the slash and never intercepts. The mocks encode wrong contracts: PUT accepts any body, steamcmd returns `installed: true`, and WS pushes `server_state` events the backend never sends. |

Other test-suite observations:
- The tests are green while P1/P3/P15 are broken because each layer mocks the other: frontend unit tests mock `useUpdateServer`, and E2E mocks every route. Add a thin contract layer, e.g. Vitest tests that replay recorded backend responses and WS envelopes, or a single Playwright smoke run against the real backend.
- Each server tab has two overlapping test files (e.g. `AdvancedTab.test.tsx` and `advanced-tab.test.tsx`).
- ~~`frontend/playwright-report/` and `frontend/test-results/` are committed.~~ **Fixed:** both are in `.gitignore` and no longer tracked.
- ~~CI triggers on a `python-rewrite` branch that no longer exists.~~ **Fixed:** CI triggers only on `master` pushes and PRs into `master`.
- Starlette now warns that `TestClient` over `httpx` is deprecated.

## 4. Documentation drift

- **README.md** still says "This is the `python-rewrite` branch … `master` (original Node.js app) is unchanged". It tells users to `git checkout python-rewrite`, which doesn't exist on the remote, and says "React 18". The Docker section runs `dahlgren/arma-server-web-admin`, the **old Node image** (the repo has no Dockerfile). The "Migrating" section promises that `servers.json` works as-is, but P14 contradicts that.
- **PLAN.md** marks Steps 32–44a and 55 complete, yet Difficulty/Network/Security never reach the config files (P2), SteamCMD is broken (P15), and most of the preset UI doesn't exist (P18). Its "React 18 + Vite 5 + Tailwind 3" headings are also stale.
- **CLAUDE.md** had stale counts (288 vs 338 backend tests, 447 vs 459 frontend), "React 18", and described `useServerStatus` as patching in place. It has been rewritten alongside this report.
- `frontend/README.md` is still the Vite template.
- `npm run gen:types` points at `/openapi.json`, but the app serves `/api/openapi.json`.
- `components.json` references a `tailwind.config.ts` that doesn't exist.
- `package.json` `engines.node: ">=18"` is too low. Vite 8, `@vitejs/plugin-react` 6 and jsdom 29 need Node `^20.19 || >=22.12`, so the README's "Node 18 minimum" is wrong too.

## 5. Upgrade candidates

### Features worth adding (ranked by value ÷ effort, building on code that already exists)

| Feature | Why / what already exists |
|---|---|
| **Live server console + persisted `.rpt` logs** | Fixes P5 in the same change. Drain stdout into a rotating log file (`cleanup_old_logs()` already exists), publish lines on the bus as `{"type": "console", "serverId": …}`, and add a console panel to the detail page. |
| **Player list** | `services/a2s.py` already calls `a2s.aplayers()` but only returns `len(players)`. Return names, scores and durations, and show them on the detail page. |
| **Crash watchdog / auto-restart and scheduled restarts** | `_monitor()` already sees every exit. Add an `auto_restart` flag with backoff, plus a cron-like restart schedule with an in-game warning (needs RCon). |
| **BattlEye RCon** (kick/ban/say/lock) | The standard admin feature this panel lacks. Write `BattlEye/beserver.cfg` with `RConPassword`/`RConPort` at start and talk to it over UDP. |
| **Config preview** | `GET /api/servers/{id}/config/preview` returns the exact `server.cfg` / `basic.cfg` / profile that `start()` would write. It catches P2/P10-type bugs instantly and gives users confidence. |
| **Full `server.cfg` coverage** | `app/schemas/server_config.py`, `basic_config.py` and `server_profile.py` are already modelled. Wiring them into the writers and tabs is what turns P2 from a bug into a feature. Make `basic.cfg` and the profile per-server. |
| **Workshop mods via SteamCMD** | `services/steamcmd.py` already runs SteamCMD with streamed output. `+workshop_download_item 107410 <id>` plus the existing `mod_linker` would give a Caddy-free mod pipeline. (Arma 3 workshop downloads need a Steam login rather than `anonymous`.) |
| **Persist preset state** | `_presets` / `_comparison` / `_missing_report` vanish on restart (`app/api/presets.py:26`). Write them to a JSON file next to `servers.json`, and key presets by preset name instead of the temp filename. |
| **Finish the preset UI** | 13 endpoints and the progress events are ready. The UI needs comparison, link status, missing report, sync and name-check views (P18). |
| **Backup / export / import of servers** | `servers.json` is the only state. Add download/upload with schema validation (reuse `scripts/migrate_servers_json.py`). |
| **Better auth** | Replace Basic-in-sessionStorage with a login endpoint that issues an HttpOnly session cookie. That fixes WS token-in-URL, downloads without auth (P17) and plaintext storage at once. Optional later: multiple users/roles and an audit log of start/stop/edit. |

### Platform and dependency upgrades

- **Python 3.9 has been EOL since Oct 2025.** Raise the floor to 3.11+. Python 3.12/3.13 support Windows Server 2016, and the README already recommends 3.12. This removes the `asyncio.TimeoutError` trap (P6, `ws.py`), lets you drop `eval-type-backport`, and fixes the mypy `python_version` error.
- **Pin upper bounds** in `pyproject.toml` (everything is `>=` today) and commit a lockfile (`uv.lock`). FastAPI 0.143 / Starlette 1.8 are already in use, and the TestClient-over-httpx deprecation will turn into a break.
- **Use `response_model`s** on routes (they currently return `dict[str, Any]`), so `/api/openapi.json` is meaningful and `npm run gen:types` can replace the hand-maintained `src/types/api.ts` (fix the script URL first).
- **Frontend:**
  - Move `shadcn` and `@tailwindcss/vite` to devDependencies.
  - Remove the unused `next-themes`, `tailwindcss-animate`, `@fontsource-variable/geist`, `autoprefixer` and `postcss`.
  - Bump `engines.node` to `^20.19 || >=22.12`.
  - Run `npm audit fix`.
  - Lazy-load routes (`React.lazy` per screen) to get well under the bundle gate.
  - Majors available: React Router 7, ESLint 10, Vitest 5, TypeScript 7, framer-motion 14 (now `motion`). Do React Router 7 first; it's mostly import renames from `react-router-dom` to `react-router`.
- **Docker:** add a real multi-stage Dockerfile (Node build → slim Python runtime), because the README points at the old Node image.

## 6. Suggested order of work

1. **Close the destructive holes now**: ~~S0 (`update-mods` and the other preset path joins), S1 (upload filename), S7 (Caddy listing names)~~ ✅ fixed. S2 (fail-open auth / CWD-relative config) is still open. Until it's fixed, don't expose the panel beyond localhost or a VPN.
2. ~~**Make CI green**: ruff `N815` ignore plus autofix, fix or delete `list_mod_updates`, and the two ESLint errors.~~ **Done** (§3); `list_mod_updates` was fixed, not deleted.
3. **Make the core loop work**: P5 (drain stdout), ~~P4 (query port), P13 (Stop button)~~ ✅, P6 (TimeoutError), P1 (partial PUT), P3 (WS payload), P22 (no reload in prod). Add one integration test per fix that exercises the *real* contract.
4. **Stop data loss and corruption**: P19 (`servers.json` load/save), P7 and P23 (id collisions and re-keying), P8 (stale form across servers, rename navigation), P9 (validation), P10 (cfg escaping), P14 (`template`).
5. **Wire config coverage (P2, P21)** with a config-preview endpoint and golden tests, then fix or hide the dead UI (P15, P16, P18, P20).
6. **Then features and upgrades (§5)**: Python floor, dependency cleanup, console/log streaming, player list, RCon.
