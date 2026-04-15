# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Branch context

**Active branch**: `master` — Node.js/Express + Backbone.js fully replaced by FastAPI + React 18/Vite/TypeScript.
**Phase status**: ALL 5 PHASES COMPLETE ✅ (288 backend tests passing, 3 skipped; 126 frontend Vitest tests; 75 E2E Playwright tests; 80.03% backend coverage).
See `PLAN.md` for the full step checklist and all architectural decisions.

## Current state (as of 2026-04-15)

- Backend: FastAPI on port 9500, all routes implemented and tested.
- Frontend: React 18 + Vite on port 9510 (dev), served from `frontend/dist/` (prod).
- Tests: 288 backend tests pass (`python -m pytest tests/ -q`), 3 skipped (Linux symlink tests on Windows); 126 frontend Vitest tests pass.
- Coverage: 80.03% (`fail_under = 80` enforced via `pyproject.toml`).
- Auth: Custom login screen with dedicated `GET /api/auth` probe endpoint (no credentials needed).
- Theme: Dark mode is the **CSS default** — no class or JS required. Light mode only when `.light` is on `<html>`.
- UI: Iris glassmorphism design with animated gradient background, translucent glass surfaces, framer-motion page transitions, and mobile hamburger sidebar.
- Deployment: `frontend/dist/` is gitignored. Server must run `cd frontend && npm run build` after every `git pull`.

## What to do in a new session

- **Bug fix**: Read the relevant file(s) first. Run `python -m pytest tests/ -q` before and after to confirm no regressions. Check coverage hasn't dropped below 80%.
- **New feature**: Follow PLAN.md architectural decisions. Write tests first (TDD). Update this file and PLAN.md with what changed.
- **Frontend change**: Run `cd frontend && npm run typecheck && npm run lint` after edits. For UI changes, start dev server and test in browser.
- **New API route**: Add to `app/api/`, add integration test in `tests/backend/integration/`, re-check coverage.
- **After any frontend change on the server**: `cd frontend && npm run build` then restart the Python server.

## Known non-obvious bugs (already fixed — don't re-introduce)

| Bug | File | Fix |
|-----|------|-----|
| `MOD_SCAN_GLOB` brace expansion | `app/domain/mods.py` | Python `Path.glob()` doesn't support `{a,b}` syntax. Use multiple explicit patterns with a `seen` set. |
| `GET /{name}` wildcard intercepting literal routes | `app/api/presets.py` | FastAPI evaluates routes in registration order. `/{name}` MUST be the last `GET` route in the router. |
| `_is_junction()` using `path.stat()` | `app/services/mod_linker.py` | `stat()` follows junctions. Use `path.lstat()` to get the junction's own attributes. |
| `structlog.stdlib.add_logger_name` crash | `app/core/logging.py` | Requires `stdlib.LoggerFactory`. Not in processor chain — use `PrintLoggerFactory` instead. |
| Auth lockout state polluting tests | `tests/backend/unit/test_auth.py` | `app.api._fail_counts` and `_fail_times` are module-level dicts. Clear them in test setup/teardown. |
| Auth probe using protected endpoint | `frontend/src/features/auth/useAuth.tsx` | Old probe called `GET /api/servers` (requires auth) — non-401 errors bypassed login entirely. Fixed: probe `GET /api/auth` (no auth needed, returns `{auth_required: bool}`). |
| Dark mode not applying | `frontend/src/styles/` | Dark was conditional on `.dark` class set by JS — caused white flash and permanent white if localStorage had "light". Fixed: dark is now `:root` default in CSS, light mode requires `.light` class only. |
| `asyncio.TimeoutError` not caught in Python 3.9 | `app/api/ws.py` | `asyncio.TimeoutError` ≠ builtin `TimeoutError` before Python 3.11. The 30s keepalive ping was never firing — caught as unhandled exception instead. Fixed: `except (TimeoutError, asyncio.TimeoutError)`. |
| All API list endpoints getting 307 redirect + auth drop | `frontend/src/hooks/` | FastAPI routes defined as `@router.get("/")` under a prefix live at `/api/X/`. Calls to `/api/X` got a 307 redirect and the `Authorization` header was dropped. Fixed: always use trailing slash in all frontend API calls. |
| Frontend type fields not matching backend schema | `frontend/src/types/api.ts` | `Mission.filename` → `Mission.name`/`missionName`/`worldName`; `LogEntry.filename` → `LogEntry.name`; `LogEntry.lastModified` → `LogEntry.modified`; `Mod.steamId` removed, `Mod.formattedSize` added. |
| `index.html` cached by browser after rebuild | `app/main.py` | `spa_fallback` served `index.html` with no cache headers. Browser kept serving old asset hashes. Fixed: added `Cache-Control: no-store`. |
| `Preset` schema missing `source_file`/`mod_count` | test helpers | `_preset()` helper must pass `source_file` and `mod_count`; `groups` field does not exist. |
| Switch thumb invisible in dark-default theme | `frontend/src/components/ui/switch.tsx` | `dark:` Tailwind variants require a `.dark` class on `<html>`. Our theme uses `:root` defaults without any class. `bg-background` (dark surface) on thumb was invisible against dark track. Fixed: removed `dark:` prefixes; use `data-checked:bg-primary-foreground data-unchecked:bg-foreground` directly. |
| `availableMods` always empty in ModsTab | `frontend/src/features/servers/tabs/ModsTab.tsx` | State was `useState<string[]>([])` — never populated from `useMods()` hook. Fixed: derive `availableMods` by filtering `allMods` against the `activeSet`. |
| Missions stored as strings losing difficulty | `frontend/src/features/servers/tabs/MissionsTab.tsx` | Backend `server_config.py` stores missions as `{template, difficulty}` objects but old frontend code treated them as plain strings. Fixed: `parseMissions()` handles both string entries and `{template, difficulty}` objects for backward compatibility. |
| Entire ServerCard was a `<Link>` | `frontend/src/components/servers/ServerCard.tsx` | Wrapping the full card in `<Link>` made it impossible to place action buttons without triggering navigation. Fixed: outer `<div>`, title area is `<Link>`, bottom row contains action buttons. |
| `asChild` prop rejected by Base UI `DialogTrigger`/`AlertDialogTrigger` | `AddServerDialog.tsx`, `ServerDetailScreen.tsx` | Base UI uses a `render` prop instead of Radix's `asChild` pattern. `asChild` is unknown to Base UI's types. Fixed: `<DialogTrigger render={<Button />}>`, `<DialogClose render={<Button />}>`, `<AlertDialogTrigger render={<Button />}>`. |

---

## Python backend (Phase 1 — complete)

### Run the dev server

```bash
# Install deps (first time) — requires Python 3.9+
pip install -e .
# OR with uv: uv sync

# Start backend (hot-reload)
uvicorn app.main:app --reload --port 9500

# OR run as module (uses config.json port/host)
python -m app.main

# Run all backend tests
python -m pytest tests/ -q

# Run with coverage
python -m pytest tests/ -q --cov=app --cov-report=term-missing
```

### Config

Copy `config.json.example` to `config.json` and set `game`, `path`, `port`, `type`.
The app starts without `config.json` but `path` will be empty (mods/missions won't scan).

### Architecture

Entry point: `uvicorn app.main:app`

```
app/
├── core/
│   ├── config.py        # pydantic-settings Settings (reads config.json + ARMA_* env vars)
│   ├── paths.py         # Path helpers: servers.json, mods dir, missions dir, logs dir
│   └── logging.py       # structlog configure_logging() + AccessLogMiddleware
├── schemas/
│   ├── server.py        # Persisted ServerSchema (extra="allow", exact camelCase/snake_case)
│   ├── server_config.py # Full server.cfg schema (grouped sub-models)
│   ├── basic_config.py  # basic.cfg / Arma3.cfg schema + BANDWIDTH_PRESETS
│   ├── server_profile.py# .Arma3Profile schema (20+ DifficultyOptions flags)
│   ├── game_types.py    # Per-game feature flags, Steam app IDs
│   ├── preset.py        # ModEntry, Preset, Comparison, MissingReport, LinkStatus, NameCheckResult
│   ├── mission.py       # MissionSchema: name, missionName, worldName, size, sizeFormatted, dateCreated, dateModified
│   ├── mod.py           # ModSchema: name, size, formattedSize, modFile, steamMeta
│   ├── log.py           # LogSchema: name, path, size, formattedSize, created, modified
│   └── ...              # settings.py, ws.py
├── domain/
│   ├── manager.py       # Manager: load/save servers.json, add/update/remove/auto_start
│   ├── server.py        # Server: start/stop, config writing, A2S polling, to_json()
│   ├── config_writer/   # server_config.py, basic_config.py, profile_config.py
│   ├── missions.py      # list/save/delete .pbo files
│   ├── mods.py          # scan mod folders (MOD_SCAN_GLOB)
│   ├── logs.py          # list/delete .rpt logs (20-log retention, Linux only)
│   └── settings.py      # get_settings_schema() → camelCase dict for frontend
├── services/
│   ├── pubsub.py        # EventBus: asyncio.Queue per WS connection, bounded fan-out
│   ├── a2s.py           # python-a2s wrapper → {online, players, maxPlayers, mission, map}
│   ├── steamcmd.py      # SteamCMD subprocess wrapper, streams progress to EventBus
│   ├── workshop.py      # Steam Workshop file info + download
│   ├── preset_parser.py # Parse Arma Launcher .html → Preset (xml.etree, regex steam ID)
│   ├── preset_compare.py# compare_presets() → Comparison (steam_id-first mod identity)
│   ├── mod_linker.py    # junction/symlink create/remove (lstat() not stat() on Windows!)
│   ├── mod_fetcher.py   # httpx.AsyncClient Caddy downloads (Caddy JSON guard, size=0 fix)
│   ├── mod_migrator.py  # Move mod folders between groups (remove junction BEFORE move)
│   ├── mod_cleaner.py   # Find/delete orphan mod folders
│   ├── mod_reporter.py  # build_missing_report() — MissingMod.group field is critical
│   └── mod_updater.py   # Re-download stale/missing files, delete local-only files
├── api/
│   ├── __init__.py      # require_auth() — hmac.compare_digest, disabled when creds empty
│   ├── auth.py          # GET /api/auth — returns {auth_required: bool}, no credentials needed
│   ├── servers.py       # 7 routes + config sub-resource
│   ├── missions.py      # 6 routes (upload max 64, download, workshop)
│   ├── mods.py          # GET /
│   ├── logs.py          # list, delete, view/download
│   ├── settings.py      # GET /
│   ├── steamcmd.py      # install, update, branch, version
│   ├── presets.py       # 16 preset pipeline endpoints
│   └── ws.py            # /ws WebSocket: initial snapshot + EventBus streaming
└── main.py              # create_app(): lifespan, routers, static mount + no-store index.html
```

### Key invariants (do not break)

- **`servers.json` field names**: `ServerSchema` preserves mixed camelCase/snake_case (`forcedDifficulty`, `additionalConfigurationOptions`, `battle_eye`, etc.) — changing any breaks existing installs.
- **Mock target for `servers.json` in tests**: `app.domain.manager.SERVERS_JSON` (not `app.core.paths`).
- **Windows junctions**: `mod_linker._is_junction()` uses `path.lstat()` — `path.stat()` follows junctions and returns wrong attributes.
- **Junction removal**: always `os.rmdir()` — never `shutil.rmtree()` (deletes actual mod files on Windows).
- **`structlog.stdlib.add_logger_name`** crashes with `PrintLoggerFactory` — not in processor chain.
- **`httpx.AsyncClient`** is used everywhere — `requests` is not a dependency.
- **WebSocket keepalive**: catch `(TimeoutError, asyncio.TimeoutError)` — they are different classes in Python 3.9.
- **All API list routes need trailing slash**: FastAPI prefix routes live at `/api/X/`. Calls to `/api/X` get a 307 that drops `Authorization`.
- **`index.html` must not be cached**: `spa_fallback` sends `Cache-Control: no-store` — do not remove this header.

### Tests

```
tests/
├── conftest.py                          # app fixture (TestClient + tmp config)
├── backend/
│   ├── unit/
│   │   ├── test_manager_persistence.py  # servers.json round-trip
│   │   ├── test_schemas.py              # schema validation + field names
│   │   ├── test_schemas_extra.py        # BasicConfigSchema, GameType, WsEnvelope, etc.
│   │   ├── test_preset_parser.py        # HTML preset parsing
│   │   ├── test_preset_compare.py       # compare_presets() logic
│   │   ├── test_mod_linker.py           # junction/symlink create/remove/detect
│   │   ├── test_mod_migrator.py         # move mod folders between groups
│   │   ├── test_mod_fetcher.py          # Caddy HTTP downloads (respx mocks)
│   │   ├── test_mod_cleaner.py          # orphan folder detection + deletion
│   │   ├── test_mod_reporter.py         # missing mod report generation
│   │   ├── test_mod_updater.py          # stale file re-download
│   │   ├── test_config_writer.py        # server.cfg golden output
│   │   ├── test_config_writers.py       # basic.cfg + .Arma3Profile writers
│   │   ├── test_domain_logs.py          # list/get/delete/cleanup log files
│   │   ├── test_domain_mods.py          # list_mods() filesystem scan
│   │   ├── test_a2s.py                  # A2S query wrapper (AsyncMock)
│   │   ├── test_pubsub.py               # EventBus publish/subscribe/drop
│   │   ├── test_steamcmd.py             # SteamCMD subprocess (MagicMock)
│   │   ├── test_workshop.py             # Workshop HTTP calls (respx mocks)
│   │   └── test_auth.py                 # HTTP Basic Auth + IP lockout
│   └── integration/
│       ├── test_api_servers.py          # CRUD + start/stop endpoints
│       ├── test_api_servers_extra.py    # update, config, start/stop, create validation
│       ├── test_api_missions.py         # upload, download, delete, workshop
│       ├── test_api_logs.py             # list, view, download, delete
│       ├── test_api_mods_settings.py    # GET /api/mods/ + GET /api/settings/
│       ├── test_api_steamcmd.py         # install, update, branch, version
│       ├── test_api_presets.py          # 16 preset endpoints (module state reset fixture)
│       └── test_api_ws.py              # WebSocket smoke test
```

**288 passing, 3 skipped** (Linux-only symlink tests on Windows). Coverage: **80.03%**.

#### Test writing tips

- **Mock `SERVERS_JSON`**: patch `app.domain.manager.SERVERS_JSON`, not `app.core.paths.SERVERS_JSON`.
- **Preset module state**: `_presets`, `_comparison`, `_missing_report` in `app/api/presets.py` are module-level globals. Reset them in `autouse` fixtures or tests will bleed state.
- **httpx mocks**: use `respx.mock` context manager. Do not use `unittest.mock.patch` on httpx internals.
- **Async subprocess (steamcmd)**: mock with `unittest.mock.MagicMock()`, set `stdout.readline = AsyncMock(side_effect=[b"line\n", b""])`.
- **Auth lockout**: import `app.api` and clear `_fail_counts` / `_fail_times` dicts between tests.

---

## Frontend (Phase 2 — complete)

### Frontend commands

```bash
cd frontend

npm run dev          # Vite dev server on :9510 (proxies /api + /ws to :9500)
npm run build        # Production build → frontend/dist/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # Vitest (94 tests)
npm run test:watch   # Vitest watch mode
npm run gen:types    # openapi-typescript → src/types/api.ts (backend must be running)
```

### Architecture

```
frontend/src/
├── main.tsx                   # Entry point, imports globals.css
├── App.tsx                    # QueryClientProvider + TooltipProvider + Toaster + RouterProvider
├── router.tsx                 # All routes with real screens
├── styles/
│   ├── tokens.css             # CSS custom properties — dark is :root default, .light overrides
│   └── globals.css            # Tailwind v4 + shadcn theme mapping + status-breath animation
├── lib/
│   ├── api.ts                 # Typed fetch wrapper (GET/POST/PUT/DELETE + auth + ApiError)
│   ├── query-client.ts        # TanStack Query v5 (staleTime 30s, no mutation retry)
│   ├── ws.ts                  # WebSocket client with exponential backoff reconnect
│   ├── theme.ts               # dark = no class, light = .light on <html>; localStorage persist
│   └── utils.ts               # cn() from shadcn (clsx + tailwind-merge)
├── hooks/
│   ├── useTheme.ts            # React hook wrapping theme.ts
│   ├── useServers.ts          # TanStack Query CRUD + start/stop + toast notifications
│   ├── useMissions.ts         # Mission list, delete, refresh, workshop + toast
│   ├── useMods.ts             # Mod list hook
│   └── useServerStatus.ts     # WS → TanStack Query cache patching for live updates
├── types/
│   └── api.ts                 # Hand-maintained types matching backend schemas
├── components/
│   ├── ui/                    # shadcn/ui copies (16 components including sonner toast)
│   ├── servers/
│   │   ├── ServerCard.tsx     # Card with status indicator + player count
│   │   └── StatusDot.tsx      # Animated status dot (2s breath, prefers-reduced-motion)
│   └── layout/
│       ├── AppShell.tsx       # Sidebar + Topbar + content area + mobile sidebar state
│       ├── Sidebar.tsx        # Glass sidebar with Iris active indicator + framer-motion hover
│       ├── MobileSidebar.tsx  # Animated off-canvas sidebar with spring slide
│       ├── Topbar.tsx         # Glass topbar with hamburger (mobile) + breadcrumb
│       ├── AnimatedOutlet.tsx # framer-motion page transitions (opacity + y)
│       ├── Breadcrumb.tsx     # Path-based breadcrumb
│       └── ThemeToggle.tsx    # Dark/light toggle button
└── test/
    └── setup.ts               # Vitest + @testing-library/jest-dom + matchMedia mock
```

### Key decisions

- **Tailwind v4** — config is in CSS, not `tailwind.config.ts`. No `postcss.config.js`.
- **shadcn base-nova style** — v4 default. `@layer base` maps shadcn vars to our tokens.
- **Dark-first theme**: dark mode is the CSS `:root` default. Light requires `.light` class on `<html>`. No `prefers-color-scheme` used — this is an admin tool.
- **`html` element gets an animated gradient background** (4-color indigo/violet drift, 18s cycle) so there is zero white flash even before CSS parses.
- **All frontend API list calls use trailing slash** (`/servers/`, `/mods/`, etc.) to avoid FastAPI's 307 redirect that drops the `Authorization` header.
- **Frontend API types are hand-maintained** in `src/types/api.ts`. Run `npm run gen:types` against a live backend to regenerate. Key fields: `Mission.name/missionName/worldName`, `LogEntry.name/modified`, `Mod.formattedSize`.
- **WebSocket client** (`ws.ts`) — single shared instance, auto-connects on first subscriber, auto-disconnects on last unsubscribe.
- **useServerStatus** — patches TanStack Query cache in-place on WS events; invalidates mod/mission/log/settings queries on change events.

### Design system

Iris glassmorphism theme with animated gradient background. Key tokens (oklch, hue 275 = indigo/violet):
- Page background: animated gradient (`#1e1b4b → #3b0764 → #0f172a → #1e1b4b`)
- Surface (glass): `rgb(255 255 255 / 0.05)` + `backdrop-blur(24px)` + `border-white/10`
- Surface raised (hover): `hover:bg-white/10`
- Accent (indigo CTA): `oklch(63% 0.22 270)`
- Danger (red buttons): `oklch(57% 0.24 25)`
- Headings: `gradient-heading` (indigo-400 → violet-400 gradient text)
- Section labels: `section-label` (uppercase, tracking-widest, indigo-400/80)
- Primary buttons: `btn-primary` (indigo-600 with glow shadow)
- Glass cards: `glass-card` (translucent + backdrop-blur + rounded-2xl)
- Form inputs: `glass-input` (translucent + backdrop-blur-sm)
- Sidebar: glass with Iris active indicator (left bar + indigo glow + ring)
- Page transitions: framer-motion AnimatePresence (opacity + y, 0.2s)
- Mobile: hamburger menu opens animated MobileSidebar (spring slide from left)
- Light mode: `.light` class on `<html>` overrides glass to `bg-white/60 border-white/80`
