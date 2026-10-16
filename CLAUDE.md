# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Web admin panel for Arma dedicated servers: **FastAPI backend** (`app/`, port 9500) + **React 19 / Vite 8 / TypeScript / Tailwind v4 / shadcn (Base UI)** frontend (`frontend/`, dev port 9510). In production the backend serves the built SPA from `frontend/dist/` as a single process. The Node.js/Express + Backbone app this replaced is gone from `master`.

- `PLAN.md` — original rewrite plan, architectural decisions ("do not re-litigate" list), phase checklist.
- `docs/PROJECT_HEALTH.md` — **current open problems, risks and upgrade candidates (audited 2026-10-16)**. Read it before trusting the "all phases complete" claims in `PLAN.md`: several UI features are not actually wired end-to-end.

## Commands

Start the backend and run backend tests from the **repo root**: `config.json` and `servers.json` are resolved relative to the CWD. Don't use `python -m app.main` or `--reload` for production; it hard-codes `reload=True`, and every reload stops all running Arma servers.

```bash
# Backend — Python >=3.9 (.python-version pins 3.9; CI uses 3.13). Code must stay 3.9-compatible.
uv sync                                   # runtime + dev deps (dev deps live under [tool.uv])
# or: pip install -e . && pip install pytest pytest-asyncio pytest-cov respx ruff mypy
uvicorn app.main:app --reload --port 9500
python -m pytest tests/ -q                                          # all backend tests
python -m pytest tests/backend/unit/test_server.py -q               # one file
python -m pytest tests/backend/unit/test_server.py::test_name -q    # one test
python -m pytest tests/ -q -k "preset and not ws"                   # by keyword
python -m pytest tests/ -q --cov=app --cov-report=term-missing      # coverage (fail_under=80, app/main.py omitted)
ruff check app/ tests/
mypy app/ --ignore-missing-imports        # CI runs this with continue-on-error

# Frontend
cd frontend
npm ci
npm run dev                               # :9510, proxies /api and /ws to :9500
npm run typecheck && npm run lint
npx vitest run                            # all unit tests
npx vitest run src/hooks/useServers.test.tsx       # one file
npx vitest run -t "<test name>"                    # by test name
npm run test:coverage
npm run test:e2e                          # Playwright; starts `npm run dev` itself, API is mocked via page.route
npm run build                             # tsc -b && vite build → frontend/dist/ (gitignored)
npm run gen:types                         # openapi-typescript — note: script points at /openapi.json but the app serves /api/openapi.json
```

`frontend/dist/` is not committed: after every `git pull` on a deployed server run `cd frontend && npm run build`, then restart the Python process.

CI (`.github/workflows/ci.yml`): backend = ruff → mypy (non-blocking) → pytest with `--cov-fail-under=80`; frontend = eslint → tsc → vitest → build → bundle-size gate (main JS ≤ 300 KB gzip). E2E is **not** run in CI. All of these gates pass on Linux; keep it that way (ruff clean, ESLint with 0 errors). CI runs on Ubuntu while day-to-day development happens on Windows, so run the suites with Linux semantics before assuming green. Path handling is the usual trap: a `\` separator only works on Windows.

## Workflow expectations

- **Bug fix**: read the relevant files first. Run `python -m pytest tests/ -q` before and after, and keep coverage ≥ 80%.
- **New feature**: follow the decisions in `PLAN.md`. Write tests first (TDD), then update this file and `PLAN.md`.
- **New API route**: add it under `app/api/`, add an integration test in `tests/backend/integration/`, and re-check coverage.
- **Frontend change**: run `npm run typecheck && npm run lint && npx vitest run`. For UI changes, also check the result in a browser with the dev server running.
- **Fixing an item from `docs/PROJECT_HEALTH.md`**: add a test that hits the *real* contract (not a mocked hook or route), then strike or remove the item.

## Architecture

### Backend request/data flow

- `app/main.py` builds the app via `create_app()` **at import time** (module-level `app = create_app()` loads `config.json` immediately). The lifespan creates one `EventBus` and one `Manager`, stores them plus `settings` on `app.state`, loads `servers.json`, and auto-starts flagged servers; on shutdown it stops running servers. On Windows it switches to `WindowsProactorEventLoopPolicy` (needed for `asyncio.create_subprocess_exec`).
- Config: `app/core/config.py` — pydantic-settings `Settings` from `config.json` + `ARMA_*` env vars (nested with `__`, e.g. `ARMA_AUTH__PASSWORD`); a few camelCase keys from the old `config.js` are remapped in `_KEY_MAP`. There are two access paths: routes use `request.app.state.settings`, while `require_auth`/WS auth/`/api/auth` use the module-global `get_settings()`. `load_settings()` updates both.
- Layers: `app/api/` (routers, thin) → `app/domain/` (Manager, Server, config writers, filesystem listings) → `app/services/` (A2S, SteamCMD, Workshop, preset/mod pipeline, pub/sub). `app/schemas/` holds pydantic models.
- **Server identity**: `Server.id = slugify(title)`. Renaming a server changes its id and its `<id>.cfg` filename; `Manager.add` does not check for collisions.
- **Server lifecycle** (`app/domain/server.py`): `start()` writes configs into the game dir (`<path>/<id>.cfg`, shared `<path>/basic.cfg`, and `<id>.Arma3Profile` when `forcedDifficulty == "Custom"`), spawns the binary from `_BINARIES[type][game]` (prefixed with `wine` for `type: wine`), then runs two tasks: `_monitor()` (awaits exit, clears runtime state) and `_poll_status()` (A2S query every 5 s on `127.0.0.1:<port>`; launches headless clients once the server answers). The process's stdout is piped but not consumed yet (PROJECT_HEALTH P5). Runtime fields `pid`/`state` are never persisted.
- **Persistence**: only `servers.json` (array of `ServerSchema` dumps, rewritten in full on every change). Preset pipeline state (`_presets`, `_comparison`, `_missing_report` in `app/api/presets.py`) is in-memory module globals and is lost on restart.
- **Auth**: `require_auth` (`app/api/__init__.py`) is attached per-router via `dependencies=[Depends(require_auth)]`. HTTP Basic, `hmac.compare_digest`, in-memory per-IP lockout (5 failures → 60 s 429). Disabled entirely when username and password are both empty. `/api/auth` is intentionally unauthenticated (login probe). The WS route does its own check (`_check_ws_auth`) accepting either an `Authorization` header or `?token=<base64 user:pass>`.
- **Live updates**: `app/services/pubsub.py` `EventBus` gives each WS connection a bounded `asyncio.Queue` (64, drop-oldest). `/ws` (`app/api/ws.py`) sends an initial snapshot (`servers`, `mods`, `missions`, `settings`), then forwards bus messages, sending `{"type":"ping"}` after 30 s idle. Envelope: `{"type", "serverId", "payload"}`. Most publishers send `payload: None` as a "something changed" signal (see `docs/PROJECT_HEALTH.md` — the frontend currently treats `servers` payloads as full data).
- **Preset/mod pipeline** (`app/api/presets.py` + `app/services/mod_*`, `preset_*`): ported from the external `arma-modlist-tools` project. Parses Arma Launcher `.html` presets, compares them (steam_id first, normalized name fallback), downloads mod files from a Caddy file server (`config.caddy`), and links mod folders into the game dir with NTFS junctions (Windows) or symlinks (Linux). Long operations stream progress over the bus.

### Frontend

- `src/App.tsx`: `QueryClientProvider` → `AuthProvider` → `AuthGate` (shows `LoginScreen` when `/api/auth` says auth is required) → `AuthenticatedApp`, which mounts `useServerStatus()` once (single shared WS) and the router.
- `src/lib/api.ts`: fetch wrapper; prefixes paths with `/api`, holds the Basic auth header in a module variable (`_getAuthHeader()` is also used by `ws.ts` to build `?token=`). Credentials are persisted in `sessionStorage` by `AuthProvider`.
- `src/lib/ws.ts`: singleton WebSocket, connects on first subscriber, disconnects on last, exponential backoff (1 s → 30 s cap) with jitter, drops `ping`.
- `src/hooks/` (plus a few inline queries in feature screens, e.g. logs, settings, steamcmd): TanStack Query v5. Query keys: `["servers"]`, `["servers", id]`, `["mods"]`, `["missions"]`, `["logs"]`, `["settings"]`, presets. `useServerStatus` patches/invalidates these from WS events (its `server` / `server_state` cases are never emitted by the backend). Server online/offline and the Start/Stop button are derived from `state.online` (A2S), not from `pid`.
- `src/router.tsx`: `/servers/:id/{general,missions,mods,difficulty,network,security,advanced}` are nested tab routes under `ServerDetailScreen`; each tab independently loads `useServer(id)`, keeps local form state, and saves with `useUpdateServer` (`PUT /api/servers/{id}`). `/presets/:id` and the 404 route are placeholders.
- `src/types/api.ts` is **hand-maintained**; keep it in sync with `app/schemas/*` by hand.
- `src/components/ui/` are shadcn copies built on **Base UI**, not Radix.

## Invariants — do not break

- **`servers.json` field names** are a mix of camelCase and snake_case (`forcedDifficulty`, `additionalConfigurationOptions`, `battle_eye`, `auto_start`, …) for compatibility with existing installs of the Node app. `ServerSchema` uses `extra="allow"` so unknown keys round-trip. Never rename fields. That's why `pyproject.toml` ignores ruff `N815` for `app/schemas/**`; don't "fix" those names.
- **Windows junctions**: detect with `path.lstat()` (never `stat()`, it follows the junction); remove with `os.rmdir()` — **never `shutil.rmtree()`**, which deletes the real mod files. Remove a junction *before* moving its target folder (`mod_migrator`).
- **Trailing slashes must match the route exactly**: collection routes are `@router.get("/")` under a prefix, so they live at `/api/X/`; item/action routes have none (`/api/servers/{id}/start`, `/api/missions/workshop`). A mismatch fails differently per environment — in dev (no `dist/`) FastAPI 307-redirects to the backend origin and the `Authorization` header is lost; in prod the SPA catch-all answers slashless GETs with `index.html` (200, not JSON) and POSTs with 405.
- **Route order**: in `app/api/presets.py`, `GET /{name}` must stay the **last** GET route or it swallows literal routes like `/comparison`.
- **Python 3.9 compatibility**: `asyncio.TimeoutError` is not the builtin `TimeoutError` before 3.11 — catch `(TimeoutError, asyncio.TimeoutError)` (`Server.stop()` still gets this wrong; PROJECT_HEALTH P6). `X | None` in pydantic models works on 3.9 only thanks to `from __future__ import annotations` + `eval-type-backport`; keep both.
- **Mod scan glob**: `Path.glob()` has no `{a,b}` brace expansion — `app/domain/mods.py` uses several explicit patterns with a `seen` set. (`MOD_SCAN_GLOB` in `paths.py` is documentation only.)
- **HTTP client**: `httpx.AsyncClient` everywhere; do not add `requests`.
- **Logging**: structlog with `PrintLoggerFactory`; do not add `structlog.stdlib.add_logger_name` (crashes without the stdlib factory).
- **SPA fallback** sends `index.html` with `Cache-Control: no-store` so browsers pick up new asset hashes after a rebuild.

### Frontend gotchas

- **Theme**: dark is the `:root` default in `src/styles/tokens.css`; light mode only when `.light` is on `<html>`. Tailwind `dark:` variants do **not** work (no `.dark` class ever exists) — style for dark by default and override with `.light`.
- **Base UI composition**: use the `render` prop (`<DialogTrigger render={<Button />}>`), not Radix's `asChild`.
- **Fast refresh / ESLint**: a `.tsx` file that exports a component must export only components (`react-refresh/only-export-components` is an error). That's why auth is split into `features/auth/AuthProvider.tsx` (component), `useAuth.ts` (hook) and `auth-context.ts` (context + `AuthState`). In tests, don't assign to outer variables during render (`react-hooks/globals`); use `renderHook` instead.
- **Tailwind v4**: config lives in CSS (`src/styles/globals.css`), there is no `tailwind.config.*`.
- Entries in `server.missions` come in three shapes: plain strings, `{template, difficulty, params}` (current), and `{name, difficulty}` (written by the old Node app). `MissionsTab.parseMissions()` and `write_server_cfg` must accept all of them — today neither handles `{name}` (see `docs/PROJECT_HEALTH.md`). `template` is `missionName.worldName` **without** `.pbo`.
- `ServerCard` is a `<div>` with only the title as a `<Link>`, so action buttons don't trigger navigation.
- UI design tokens/utilities (Iris glassmorphism): `glass-card`, `glass-input`, `btn-primary`, `gradient-heading`, `section-label` in `globals.css`; accent hue 275 (indigo/violet). Animated page transitions via framer-motion in `AnimatedOutlet`.

## Testing notes

- `tests/conftest.py` provides `app` (config in `tmp_path`, auth disabled) and `client` (`TestClient`). Integration tests go in `tests/backend/integration/`, unit tests in `tests/backend/unit/`.
- Patch **`app.domain.manager.SERVERS_JSON`** (not `app.core.paths.SERVERS_JSON`) to isolate `servers.json`; otherwise tests read/write the real file in the CWD.
- Module-level state that leaks between tests: `app.api._fail_counts` / `_fail_times` (auth lockout) and `_presets` / `_comparison` / `_missing_report` in `app/api/presets.py` — reset them in fixtures.
- Mock httpx with `respx.mock`; mock async subprocesses with `MagicMock()` whose `stdout.readline = AsyncMock(side_effect=[b"line\n", b""])`.
- Three `test_mod_linker.py` tests are Windows-only and skip on Linux.
- Frontend tests: Vitest + Testing Library + jsdom (`src/test/setup.ts` mocks `matchMedia`). Playwright E2E specs mock every `/api/**` call (`e2e/helpers/api-mocks.ts`), so they cannot catch frontend↔backend contract bugs; the visual snapshots under `e2e/screenshots.spec.ts-snapshots/` are Windows-rendered (`*-win32.png`).

## Historical bugs (fixed — don't re-introduce)

| Bug | Where | Fix |
|-----|-------|-----|
| Auth probe hit a protected endpoint; non-401 errors bypassed login | `features/auth/AuthProvider.tsx` | Probe `GET /api/auth` (unauthenticated, returns `{auth_required}`) |
| White flash / stuck light theme | `styles/` | Dark is the CSS default; no JS needed |
| Switch thumb invisible | `components/ui/switch.tsx` | No `dark:` variants; `data-checked:`/`data-unchecked:` classes directly |
| WS keepalive never fired on 3.9 | `app/api/ws.py` | Catch `(TimeoutError, asyncio.TimeoutError)` |
| 307/405 and dropped auth on collection routes | `src/hooks/*` | Trailing slash on every collection call |
| Browser kept stale `index.html` | `app/main.py` | `Cache-Control: no-store` |
| `NotImplementedError` from `create_subprocess_exec` on Windows | `app/main.py` | Proactor event loop policy |
| `availableMods` always empty | `tabs/ModsTab.tsx` | Derive from `useMods()` minus the active set |
| Active mods missing on disk shown silently | `tabs/ModsTab.tsx` | Cross-reference with scan; "Missing" badge |
| Per-mission params not written | `config_writer/server_config.py`, `MissionsTab.tsx` | Params emitted inside `Mission_N` blocks. They still need a `class Params {}` wrapper (PROJECT_HEALTH P10). |
| Frontend types drifted from schemas | `src/types/api.ts` | `Mission.name/missionName/worldName`, `LogEntry.name/modified`, `Mod.formattedSize` |
| Test helper `_preset()` incomplete | backend tests | Must pass `source_file` and `mod_count`; there is no `groups` field |
| `list_mod_updates` treated `subdir\file` as a literal filename on Linux (CI red) | `app/services/mod_fetcher.py` | Normalise `\` → `/` before joining, as `download_mod_folder` does |
| Caddy listing names trusted: `../x.dll` wrote outside the mod folder; `update-mods` deleted subfolder files (`addons//x.pbo` keys) | `app/services/mod_fetcher.py`, `mod_updater.py` | `_walk` strips the `/` Caddy appends to dir names, then `validate_name`; an unsafe name raises before any download or removal (never skip: a filtered listing makes `update_mod_folder` delete); `ensure_within` on every target |
