# Python Rewrite Plan — arma-server-web-admin

**Branch**: `python-rewrite` (from `master`)
**Status**: ALL PHASES COMPLETE ✅ — 288 backend tests (80.03% coverage), 126 frontend Vitest tests, Playwright E2E, CI green.
**Last updated**: 2026-04-15

## Completion Summary

| Phase | Status | Tests |
|-------|--------|-------|
| Phase 1 — Backend Foundation | ✅ COMPLETE | 82 → 288 backend tests |
| Phase 2 — Frontend Scaffold | ✅ COMPLETE | 35 Vitest tests |
| Phase 3 — All Screens (REST) | ✅ COMPLETE | 67 Vitest tests |
| Phase 4 — WebSocket + Polish | ✅ COMPLETE | 83 Vitest tests |
| Phase 5 — Integration, Tests, CI | ✅ COMPLETE | 94 Vitest + Playwright E2E + CI |
| UX Overhaul — Server controls + tab fixes | ✅ COMPLETE | 126 Vitest (TDD, 5 bugs fixed) |

**Coverage**: 80.03% backend (`fail_under = 80` in `pyproject.toml`)
**CI**: `.github/workflows/ci.yml` — ruff + mypy + pytest-cov (backend); eslint + tsc + vitest + vite build (frontend)
**README**: Fully rewritten for Python stack with install guide, config reference, platform-specific warnings.

## Known Non-Obvious Bugs Fixed During Implementation

| Bug | File | Fix Applied |
|-----|------|-------------|
| `Path.glob()` brace expansion unsupported | `app/domain/mods.py` | Split into multiple explicit glob patterns with `seen` set dedup |
| `GET /{name}` wildcard captures literal routes | `app/api/presets.py` | Moved wildcard route to end of file — FastAPI matches in registration order |
| `_is_junction()` used `path.stat()` (follows links) | `app/services/mod_linker.py` | Changed to `path.lstat()` to read junction's own attributes |
| `structlog.stdlib.add_logger_name` crashes | `app/core/logging.py` | Requires `stdlib.LoggerFactory`; removed from processor chain |
| Module-level auth state pollutes tests | `app/api/__init__.py` | `_fail_counts`/`_fail_times` must be cleared between test cases |
| `Preset` schema field mismatch in test helpers | test files | Schema has `source_file`, `mod_count`; no `groups` field |
| Switch thumb invisible in dark-default theme | `frontend/src/components/ui/switch.tsx` | `dark:` variants need `.dark` class; theme uses `:root` defaults. Fixed: `data-checked:bg-primary-foreground data-unchecked:bg-foreground` |
| `availableMods` always empty | `frontend/src/features/servers/tabs/ModsTab.tsx` | `useState<string[]>([])` never populated from `useMods()`. Fixed: derive from `allMods.filter(m => !activeSet.has(m.name))` |
| Missions losing difficulty on round-trip | `frontend/src/features/servers/tabs/MissionsTab.tsx` | Frontend treated missions as plain strings; backend stores `{template, difficulty}`. Fixed: `parseMissions()` handles both formats |
| Entire ServerCard was a `<Link>` | `frontend/src/components/servers/ServerCard.tsx` | Full-card link blocked action buttons. Fixed: outer `<div>`, title is `<Link>`, bottom row has buttons |

---

## Goal

Convert the existing Node.js/Express + Backbone.js Arma server admin panel into a modern Python web application. The rewrite is **incremental and phased**. The `master` branch stays deployable throughout.

---

## Decisions (final — do not re-litigate)

### Backend: FastAPI

- Async-native, Pydantic v2 validation, first-class WebSocket via Starlette
- Drops Socket.io — replaced by native WebSocket with a typed pub/sub bus
- One process serves the API and the built frontend bundle

### Frontend: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui

- shadcn/ui components are **copied in** to `frontend/src/components/ui/` (not a runtime dep)
- TanStack Query v5 for data fetching; WebSocket events patch the query cache directly
- Design reference: **Linear.app** + **Vercel dashboard** aesthetic
- Dark mode primary, light mode first-class equal, `prefers-color-scheme` on first visit

### Design Tokens (implement in `frontend/src/styles/tokens.css`)

```css
/* Dark (default) */
--color-bg:           oklch(14% 0.01 265);
--color-surface:      oklch(18% 0.01 265);
--color-surface-raised: oklch(22% 0.01 265);
--color-text:         oklch(96% 0 0);
--color-text-muted:   oklch(68% 0.01 265);
--color-border:       oklch(28% 0.01 265);

/* Light (applied via .light class on <html>) */
--color-bg:           oklch(99% 0 0);
--color-surface:      oklch(97% 0 0);
--color-surface-raised: oklch(100% 0 0);
--color-text:         oklch(18% 0 0);
--color-text-muted:   oklch(45% 0 0);
--color-border:       oklch(90% 0 0);

/* Accent — cool blue, used only for CTAs and focus rings */
--color-accent:       oklch(68% 0.18 255);

/* Semantic */
--color-success:      oklch(72% 0.17 155);
--color-warning:      oklch(78% 0.16 75);
--color-danger:       oklch(62% 0.22 25);

/* Typography */
--font-sans: 'Inter Variable', system-ui, sans-serif;
--font-mono: 'JetBrains Mono Variable', monospace;

/* Type scale — admin baseline is 14px, not 16px */
--text-xs:   12px;
--text-sm:   13px;
--text-base: 14px;
--text-lg:   16px;
--text-xl:   20px;
--text-2xl:  24px;
--text-3xl:  32px;
```

### Layout

- Persistent **240px left sidebar**: app mark, primary nav, pinned server list with live status dots, theme toggle + version in footer
- **56px topbar**: breadcrumbs, contextual primary action (Start/Stop current server), toast anchor
- **Content area**: `max-width: 1440px`, 32px horizontal padding
- Server detail uses a **horizontal tab strip** (Info / Missions / Mods / Difficulty / Network / Security / Advanced / Headless), tab state synced to URL

### Rejected (do not revisit without strong reason)

| Option | Reason rejected |
|--------|----------------|
| HTMX + Jinja2 | Drag-reorder, dual-list, tabbed nested forms are awkward; more hand-rolled JS than it looks |
| Vue 3 | shadcn-vue lags React original; fewer Linear/Vercel reference implementations available |
| Flask | Sync-first; async subprocess + WebSocket requires extra libs |
| Django | ORM/admin/templates unused; too heavy for flat-file persistence |
| Keep Backbone bundle | Legacy Backbone.js/Marionette — replace entirely, no shim |
| Socket.io (Python) | Only 4 event topics in use; native WebSocket is 30 LOC and removes the JS client dep |

---

## arma-modlist-tools Porting Notes

These are non-obvious bugs, edge cases, and design decisions discovered by auditing the original source. **Read before implementing any preset service.**

### CRITICAL: Junction handling on Windows

**Bug to avoid**: `os.path.islink()` returns `False` for Windows NTFS junctions. Using it will make `link-status` always report "unlinked" and `unlink_group` silently fail.

**Correct detection** (replicate exactly in `mod_linker.py`):
```python
def _is_junction(path: Path) -> bool:
    if sys.platform == "win32":
        return bool(path.stat().st_file_attributes & 0x400)  # FILE_ATTRIBUTE_REPARSE_POINT
    return path.is_symlink()
```

**Bug to avoid**: `shutil.rmtree()` **must never** be called on a junction. On Windows it follows the reparse point and deletes the actual mod folder contents, not just the link.

**Correct removal**:
```python
# Windows junction:
os.rmdir(link_path)
# Linux symlink:
os.unlink(link_path)
```

### CRITICAL: Junction removal before migration

When `mod_migrator.py` moves a mod folder that has an active junction pointing to it, the stale junction must be **removed before** `shutil.move()`, and recreated after. If skipped, `link_group` will see the stale junction as "already_linked" and not recreate it at the new path. The migrator must also update its **in-memory index after each move** so subsequent targets in the same migration run don't re-match the already-moved path.

### httpx instead of requests

All Caddy HTTP calls in `mod_fetcher.py` must use `httpx.AsyncClient` (not `requests.Session`). Mapping:

| Original (requests) | FastAPI port (httpx) |
|---|---|
| `make_session(auth)` | `httpx.AsyncClient(auth=auth, timeout=httpx.Timeout(120.0))` |
| `session.get(url)` | `await client.get(url)` |
| `response.json()` | `response.json()` |
| Stream download | `async with client.stream("GET", url) as r:` |

Guard against Caddy returning a wrapped response instead of a plain list (replicating fetcher.py line 52–54):
```python
data = response.json()
items = data if isinstance(data, list) else data.get("items", [])
```

### meta.cpp must be opened with errors="replace"

Community mod folders frequently contain non-UTF8 characters in meta.cpp. Always open as:
```python
open(path, encoding="utf-8", errors="replace")
```
Failure to do this raises `UnicodeDecodeError` on read and breaks steam_id extraction.

### File size = 0 from Caddy means "unknown"

`list_mod_updates()` uses a truthiness check, not `!= 0`:
```python
if server_size and local.stat().st_size != server_size:
    # add to stale list
```
Without this, mods with unreported sizes get re-downloaded on every update call.

### Backslash normalization in update-mods

When comparing local file paths against the server's file list, Windows backslashes must be normalized before the comparison:
```python
rel_path = str(rel_path).replace("\\", "/")
```

### Progress streaming for long-running preset operations

The original `build_server_index()` takes a synchronous `progress_fn(current, total, name)` callback. In the FastAPI port, all long-running preset operations (`fetch`, `sync-missing`, `update-mods`, `migrate`, `clean-orphans`) must stream progress via the existing `EventBus` pub/sub, not a sync callback. Publish events of the form:
```python
await bus.publish("presets", {"op": "fetch", "current": i, "total": n, "name": folder_name})
```

The `migrator.py` service also calls `print()` directly for all progress output. Replace every `print()` call with `await bus.publish(...)` in the async port.

### Mod identity: steam_id first, name fallback

Throughout all preset services, mod matching always prefers steam_id over display name:
```python
def mod_key(mod: dict) -> str:
    return mod.get("steam_id") or mod["name"]
```
This must be consistent across parser, compare, fetcher, migrator, and reporter — otherwise the same mod under two different display names will appear as two separate mods in the comparison.

### Name normalization is aggressive

`_normalize_name()` strips `@`, lowercases, and removes **all** non-alphanumeric characters:
- `"@CBA_A3"` → `"cbaa3"`
- `"@US GEAr- Units (IFA3)"` → `"usgearunitsifa3"`

Use this exact normalization (not just `.lower().strip()`) in `mod_fetcher.py`'s server index build and `mod_linker.py`'s folder lookup, or name-based fallback matching will fail.

---

## What Gets Deleted on This Branch

```
public/js/app/**       ← entire Backbone SPA
public/js/tpl/**       ← Handlebars templates
public/js/app.js       ← webpack entry point
public/css/styles.css  ← legacy styles
public/index.html      ← replaced by frontend/dist/index.html
routes/**              ← ported to app/api/
app.js                 ← replaced by app/main.py
package.json           ← Node app entry (keep only if frontend needs Node)
webpack.config.js      ← replaced by Vite
```

The `public/favicon.ico` and `public/` directory can be kept; Vite will copy the icon.

---

## Final Project Layout

```
arma-server-web-admin/
│
├── app/                          ← Python backend (FastAPI)
│   ├── main.py                   # App factory, startup/shutdown, static mount
│   ├── core/
│   │   ├── config.py             # pydantic-settings (mirrors config.js keys)
│   │   ├── paths.py              # Resolved filesystem paths (servers.json, mods dir, etc.)
│   │   └── logging.py            # structlog + Starlette request middleware
│   ├── api/
│   │   ├── servers.py            # /api/servers[/*]
│   │   ├── missions.py           # /api/missions[/*]
│   │   ├── mods.py               # /api/mods[/*]
│   │   ├── logs.py               # /api/logs
│   │   ├── settings.py           # /api/settings
│   │   ├── steamcmd.py           # /api/steamcmd — install, update, branch switch
│   │   ├── presets.py            # /api/presets — HTML parse, compare, fetch, link, migrate, clean
│   │   └── ws.py                 # /ws WebSocket endpoint
│   ├── domain/
│   │   ├── manager.py            # Replaces lib/manager.js — servers.json CRUD
│   │   ├── server.py             # Replaces lib/server.js — Server lifecycle
│   │   ├── config_writer/        # NEW — config file generators
│   │   │   ├── __init__.py
│   │   │   ├── server_config.py  # Writes server.cfg from ServerConfigFull
│   │   │   ├── basic_config.py   # Writes basic.cfg / Arma3.cfg from BasicConfigSchema
│   │   │   └── profile_config.py # Writes .Arma3Profile from ServerProfileSchema
│   │   ├── missions.py           # Replaces lib/missions.js
│   │   ├── mods.py               # Replaces lib/mods/index.js
│   │   ├── logs.py               # Replaces lib/logs.js
│   │   └── settings.py           # Replaces lib/settings.js — exposes ALL config keys (not just game/path/type)
│   ├── schemas/
│   │   ├── server.py             # Persisted schema — exact field parity with servers.json
│   │   ├── server_config.py      # NEW — Full server.cfg schema (grouped by category)
│   │   ├── basic_config.py       # NEW — basic.cfg / Arma3.cfg network tuning schema
│   │   ├── server_profile.py     # NEW — .Arma3Profile difficulty schema
│   │   ├── game_types.py         # NEW — per-game feature flags & Steam app IDs
│   │   ├── mission.py
│   │   ├── mod.py
│   │   ├── log.py
│   │   ├── settings.py
│   │   ├── preset.py             # Preset, ModEntry, Comparison, MissingReport, LinkStatus, NameCheckResult schemas (from arma-modlist-tools)
│   │   └── ws.py                 # WebSocket envelope: {type, serverId, payload}
│   └── services/
│       ├── pubsub.py             # Async fan-out pub/sub (asyncio.Queue per connection)
│       ├── a2s.py                # python-a2s wrapper (replaces Gamedig)
│       ├── steamcmd.py           # NEW — SteamCMD install/update/branch management
│       ├── workshop.py           # httpx + Steam Web API (replaces steam-workshop npm)
│       ├── process.py            # asyncio subprocess mgmt — server binary launch, headless client launch, process lifecycle (replaces arma-server npm)
│       ├── preset_parser.py      # Parse Arma 3 Launcher .html preset exports → JSON (from arma-modlist-tools)
│       ├── preset_compare.py     # Compare 2+ presets → shared/unique breakdown (from arma-modlist-tools)
│       ├── mod_fetcher.py        # Download mods from Caddy via httpx.AsyncClient + Basic Auth; progress → EventBus (from arma-modlist-tools fetcher.py)
│       ├── mod_linker.py         # Junction/symlink mgmt — Windows: FILE_ATTRIBUTE_REPARSE_POINT, NOT os.path.islink(); removal: os.rmdir not shutil.rmtree (from arma-modlist-tools linker.py)
│       ├── mod_migrator.py       # Move mod folders; remove stale junction BEFORE shutil.move(), update in-memory index after each move; print() → EventBus (from arma-modlist-tools migrator.py)
│       ├── mod_cleaner.py        # Orphan mod *folder* detection + cleanup (from arma-modlist-tools cleaner.py)
│       ├── mod_reporter.py       # Cross-reference comparison vs Caddy index → missing report; "group" field on each entry used by mod_updater for target path (from arma-modlist-tools reporter.py)
│       └── mod_updater.py        # Re-download stale/missing files within a mod folder; also deletes local files absent from server (stale .pbo/.bisign); distinct from mod_cleaner (from arma-modlist-tools update_mods.py)
│
├── frontend/                     ← React frontend (Vite)
│   ├── index.html
│   ├── vite.config.ts            # base:'/', outDir:'dist', dev proxy /api + /ws → :9500
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── components.json           # shadcn/ui config (New York style, neutral base)
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── router.tsx            # react-router-dom v6 routes
│       ├── styles/
│       │   ├── tokens.css        # CSS custom properties (see Design Tokens above)
│       │   └── globals.css       # Tailwind directives, base resets
│       ├── lib/
│       │   ├── api.ts            # Typed fetch wrapper, zod-parsed at boundaries
│       │   ├── ws.ts             # WebSocket client, reconnect w/ exp backoff + jitter
│       │   ├── query-client.ts   # TanStack Query provider setup
│       │   ├── theme.ts          # dark/light toggle, localStorage persist
│       │   └── utils.ts          # cn(), formatters
│       ├── hooks/
│       │   ├── useServerStatus.ts  # Subscribes to WS bus, patches query cache
│       │   ├── useTheme.ts
│       │   └── useReducedMotion.ts
│       ├── types/
│       │   └── api.ts            # Auto-generated from FastAPI /openapi.json (openapi-typescript)
│       ├── components/
│       │   ├── ui/               # shadcn copies (button, card, dialog, tabs, tooltip,
│       │   │                     #   toast, input, select, switch, separator, scroll-area,
│       │   │                     #   badge, skeleton, sheet, table, alert-dialog, dropdown-menu)
│       │   ├── layout/
│       │   │   ├── AppShell.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Topbar.tsx
│       │   │   ├── Breadcrumb.tsx
│       │   │   └── ThemeToggle.tsx
│       │   ├── servers/
│       │   │   ├── ServerCard.tsx          # Overview card
│       │   │   ├── StatusDot.tsx           # 2s opacity-breath animation when online
│       │   │   ├── PlayerCount.tsx
│       │   │   ├── ServerForm.tsx          # react-hook-form + zod, grouped fields
│       │   │   ├── MissionRotationList.tsx # dnd-kit drag-to-reorder
│       │   │   ├── ModsDualList.tsx        # dual-list with keyboard move + search
│       │   │   ├── HeadlessClientsPanel.tsx
│       │   │   ├── DifficultyEditor.tsx    # NEW — forcedDifficulty preset + Custom flags
│       │   │   └── BandwidthPresetSelect.tsx # NEW — one-click network presets
│       │   ├── missions/
│       │   │   ├── MissionList.tsx
│       │   │   ├── MissionUploadDropzone.tsx  # XHR upload with progress
│       │   │   └── WorkshopImport.tsx
│       │   ├── mods/
│       │   │   ├── ModLibraryTable.tsx
│       │   │   └── ModRow.tsx
│       │   └── logs/
│       │       └── LogList.tsx
│       └── features/
│           ├── servers/
│           │   ├── OverviewScreen.tsx
│           │   ├── ServerDetailScreen.tsx
│           │   └── tabs/
│           │       ├── InfoTab.tsx          # Identity, password, max players
│           │       ├── MissionsTab.tsx      # Mission rotation + params
│           │       ├── ModsTab.tsx          # Mods dual-list
│           │       ├── DifficultyTab.tsx    # NEW — forcedDifficulty + custom flags
│           │       ├── NetworkTab.tsx       # NEW — basic.cfg + network quality + timeouts
│           │       ├── SecurityTab.tsx      # NEW — signatures, file patching, BattlEye, anti-flood
│           │       ├── AdvancedTab.tsx      # NEW — scripting hooks, lifecycle, mission rotation
│           │       └── HeadlessTab.tsx      # HC count + config
│           ├── missions/MissionsScreen.tsx
│           ├── mods/ModsScreen.tsx
│           ├── logs/LogsScreen.tsx
│           ├── settings/SettingsScreen.tsx
│           ├── steamcmd/SteamCmdScreen.tsx  # NEW — install, update, branch, version
│           └── presets/                     # NEW — Preset management (from arma-modlist-tools)
│               ├── PresetsScreen.tsx        # Overview: list presets, comparison summary
│               ├── PresetUploadDropzone.tsx # Upload .html preset exports
│               ├── PresetComparison.tsx     # Shared vs unique mods breakdown
│               ├── PresetLinkStatus.tsx    # Junction/symlink status per mod per group
│               └── PresetActions.tsx        # Fetch from Caddy, link/unlink, migrate, clean orphans
│
├── tests/
│   ├── backend/
│   │   ├── unit/
│   │   │   ├── test_manager_persistence.py  # CRITICAL: round-trip servers.json
│   │   │   ├── test_config_writer.py       # server.cfg writer golden-file test
│   │   │   ├── test_basic_config_writer.py  # NEW — basic.cfg writer golden-file test
│   │   │   ├── test_profile_writer.py       # NEW — .Arma3Profile writer test
│   │   │   ├── test_a2s_adapter.py
│   │   │   ├── test_schemas.py
│   │   │   └── test_game_types.py           # NEW — per-game feature flags
│   │   ├── integration/
│   │   │   ├── test_api_servers.py          # Golden-file parity vs Node responses
│   │   │   ├── test_api_missions.py
│   │   │   ├── test_api_mods.py
│   │   │   └── test_ws_broadcast.py
│   │   └── fixtures/
│   │       ├── servers.json                 # Snapshot of real servers.json
│   │       └── golden/                      # Captured Node API responses
│   └── frontend/
│       ├── unit/                            # Vitest + RTL
│       └── e2e/                             # Playwright
│
├── scripts/
│   └── migrate_servers_json.py             # Validates existing servers.json against new schemas
│
├── pyproject.toml
├── .python-version                         # 3.12
├── CLAUDE.md
├── PLAN.md                                 # ← this file
└── .github/
    └── workflows/
        └── ci.yml                          # backend + frontend + e2e + bundle-budget jobs
```

---

## pyproject.toml Dependencies

```toml
[project]
name = "arma-server-web-admin"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic>=2.9",
    "pydantic-settings>=2.6",
    "python-a2s>=1.3",
    "python-multipart>=0.0.12",
    "httpx>=0.27",
    "python-slugify>=8.0",
    "humanize>=4.11",
    "structlog>=24.4",
    "aiofiles>=24.1",
    "watchfiles>=0.24",
    # NOTE: do NOT add `requests` here. httpx is already listed and is async-capable.
    # arma-modlist-tools uses requests (sync), but the FastAPI port uses httpx.AsyncClient.
    # make_session(auth) → httpx.AsyncClient(auth=auth, timeout=httpx.Timeout(120.0))
]

[tool.uv.dev-dependencies]
dev = [
    "pytest>=8",
    "pytest-asyncio>=0.24",
    "pytest-cov>=6",
    "httpx",          # ASGI test client
    "respx>=0.21",    # Mock httpx
    "ruff>=0.8",
    "mypy>=1.13",
]
```

## frontend/package.json Key Dependencies

```json
{
  "dependencies": {
    "react": "^18", "react-dom": "^18",
    "@tanstack/react-query": "^5",
    "react-router-dom": "^6",
    "react-hook-form": "^7",
    "zod": "^3",
    "@hookform/resolvers": "^3",
    "@dnd-kit/core": "^6", "@dnd-kit/sortable": "^8",
    "react-dropzone": "^14",
    "lucide-react": "^0.460",
    "clsx": "^2", "tailwind-merge": "^2",
    "class-variance-authority": "^0.7",
    "tailwindcss-animate": "^1",
    "@fontsource-variable/inter": "*",
    "@fontsource-variable/jetbrains-mono": "*"
  },
  "devDependencies": {
    "typescript": "^5", "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3", "postcss": "^8", "autoprefixer": "^10",
    "openapi-typescript": "^7",
    "vitest": "^2",
    "@testing-library/react": "^16",
    "@playwright/test": "^1",
    "eslint": "^9",
    "prettier": "^3", "prettier-plugin-tailwindcss": "^0.6"
  }
}
```

---

## Implementation Phases & Step Checklist

### Phase 1 — Backend Foundation ✅ COMPLETE
*Goal: Working FastAPI backend with all REST routes + WebSocket. Can be tested with curl before frontend exists.*

- [x] **Step 1** — Branch exists (`python-rewrite`) ✓ DONE
- [x] **Step 2** — `pyproject.toml` with all deps + ruff/mypy/pytest config
- [x] **Step 3** — `.python-version` = `3.12`, `.gitignore` additions for Python artifacts
- [x] **Step 4** — `app/core/config.py`: `pydantic-settings BaseSettings` mirroring all `config.js` keys: `game`, `path`, `port`, `host`, `type`, `prefix`, `suffix`, `admins`, `parameters`, `serverMods`, `auth`, `logFormat`, `additionalConfigurationOptions`. **Plus new keys for preset pipeline:** `caddy.baseUrl`, `caddy.username`, `caddy.password` (Caddy file server for mod downloads — alternative to SteamCMD).
- [x] **Step 5** — `app/core/paths.py`: resolve `servers.json`, mods dir, missions dir, logs dir. Mod scanning glob: `**/{@*,csla,ef,gm,rf,spe,vn,ws}/addons` (matches Creator DLCs + @-prefixed mods; requires `addons` subdirectory). Missions dir: `{config.path}/mpmissions/`. Log paths are platform-specific (Windows `%LOCALAPPDATA%/{gameLogFolder}/`, Linux `{config.path}/logs/`, Wine `~/.wine/drive_c/users/{USER}/Local Settings/Application Data/{gameLogFolder}/`).
- [x] **Step 6** — `app/schemas/*.py`: Two layers of schemas:
  - `server.py` — **Persisted schema** with exact field names from `servers.json` (mix of snake_case and camelCase). Use `ConfigDict(extra="allow")` for forward-compatibility.
  - `server_config.py` — **Full server.cfg schema** (grouped: Identity, Admin, Headless, Voting, NetworkQuality, Timeouts, VoN, Security, Gameplay, MissionRotation, Lifecycle, AntiFlood, Advanced, Scripting).
  - `basic_config.py` — **basic.cfg / Arma3.cfg schema** (MaxMsgSend, MaxSizeGuaranteed, MinBandwidth, etc. + sockets.maxPacketSize).
  - `server_profile.py` — **.Arma3Profile schema** (DifficultyOptions 20+ flags, CustomAILevel skill/precision).
  - `game_types.py` — Per-game feature flags (which config sections apply per game type) and Steam app IDs.
- [x] **Step 7** — `app/domain/manager.py`: fully implement `load()` / `save()` with byte-compatible `servers.json` round-trip. **This is migration-critical** — test against real `servers.json` fixture first.
- [x] **Step 8** — `app/domain/server.py`: Server class with `start()`, `stop()`, `update()`, `query_status()` stubs + `to_json()` matching existing `toJSON()` shape. Maps persisted `ServerSchema` fields to `ServerConfigFull`, `BasicConfigSchema`, and `ServerProfileSchema` for config generation.
- [x] **Step 8a** — `app/domain/config_writer/server_config.py`: Write `server.cfg` from `ServerConfigFull`. Must produce byte-compatible output with `arma-server` npm package. Golden-file test against Node output.
- [x] **Step 8b** — `app/domain/config_writer/basic_config.py`: Write `basic.cfg` / `Arma3.cfg` from `BasicConfigSchema`. Include bandwidth preset mapping (Home 1Mbps / VPS 10Mbps / Dedicated 100Mbps / Unlimited).
- [x] **Step 8c** — `app/domain/config_writer/profile_config.py`: Write `USERNAME.Arma3Profile` from `ServerProfileSchema`. Only when `forcedDifficulty = "Custom"`.
- [x] **Step 9** — `app/services/pubsub.py`: `EventBus` with `asyncio.Queue` per subscriber, `publish(topic, payload)` fan-out, bounded queue (drop oldest on back-pressure)
- [x] **Step 10** — `app/api/ws.py`: `/ws` WebSocket endpoint — registers queue, sends initial snapshot (`{type: "missions"}`, `{type: "mods"}`, `{type: "servers"}`, `{type: "settings"}`), streams bus events. Envelope: `{"type": str, "serverId": str | None, "payload": Any}`
- [x] **Step 11** — `app/services/a2s.py`: `python-a2s` wrapper returning `{online, players, maxPlayers, mission, map}`. Maps game type to A2S protocol. Returns `None` on timeout.
- [x] **Step 12** — `app/domain/missions.py`, `mods.py`, `logs.py`, `settings.py`: implement file scanning logic ported from Node counterparts
- [x] **Step 13** — `app/api/servers.py`: implement all 7 routes (`GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/start`, `POST /{id}/stop`). Start/stop responses: normalized shape `{status: str, pid: int | None}` where status is `"ok"`, `"already_running"`, `"already_stopped"`, etc. The `pid` field is always present (null when stopped).
- [x] **Step 14** — `app/api/missions.py` (6 routes: `GET /`, `POST /` upload up to 64 .pbo files, `GET /{id}` download, `DELETE /{id}`, `POST /refresh`, `POST /workshop`), `mods.py` (`GET /`), `logs.py` (3 routes: `GET /`, `DELETE /{id}`, `GET /{id}/{mode}` where mode = `view` or `download`; `.rpt` files only; 20-log retention cleanup), `settings.py` (`GET /` — expose all config keys, not just `game/path/type`)
- [x] **Step 14a** — `app/api/steamcmd.py`: REST endpoints for server install (`POST /api/steamcmd/install`), update (`POST /api/steamcmd/update`), branch switch (`POST /api/steamcmd/branch`), version check (`GET /api/steamcmd/version`). `app/services/steamcmd.py`: async subprocess wrapper for SteamCMD binary with progress streaming via WebSocket.
- [x] **Step 14b** — Server config API: `PUT /api/servers/{id}/config` accepts the full `ServerConfigFull` body and writes server.cfg + basic.cfg + .Arma3Profile. `GET /api/servers/{id}/config` returns current parsed config. `GET /api/servers/{id}/config/defaults` returns per-game-type defaults.
- [x] **Step 14c** — `app/api/presets.py`: REST endpoints for preset management (from arma-modlist-tools integration) — 16 endpoints including upload, compare, fetch, link, unlink, migrate, clean-orphans, missing-report, sync-missing, update-mods, check-names.
- [x] **Step 15** — `app/core/logging.py`: structlog config + Starlette middleware logging method/path/status/user (parity with morgan `:user` token)
- [x] **Step 16** — `app/main.py`: app factory, startup ordering (load→scan→auto-start), static mount (`frontend/dist` if present, otherwise 200 placeholder)
- [x] **Step 17** — `app/api/__init__.py`: auth dependency (`HTTPBasic` with constant-time compare against config)
- [x] **Step 18** — Backend tests: `tests/backend/unit/test_manager_persistence.py` (snapshot round-trip), `test_schemas.py`, `tests/backend/integration/test_api_servers.py` (golden-file parity)
- [x] **Step 18a** — Preset service unit tests: `test_preset_parser.py`, `test_mod_linker.py`, `test_mod_migrator.py`, `test_mod_fetcher.py`. 74 passing, 3 skipped (Linux-only symlink tests running on Windows).

  **Bug found & fixed during testing**: `mod_linker._is_junction()` used `path.stat()` (follows junctions, returns target attributes) instead of `path.lstat()` (returns link's own attributes). Fixed to use `path.lstat()` — on Windows `stat()` follows the reparse point so `st_file_attributes` showed target flags, not the junction flag.

  **Patching note**: Mock target for servers.json in tests must be `app.domain.manager.SERVERS_JSON` (where it's imported), not `app.core.paths.SERVERS_JSON` (where it's defined).

  **structlog note**: `structlog.stdlib.add_logger_name` requires `stdlib.LoggerFactory` and crashes with `PrintLoggerFactory`. Removed from processor chain.

### Phase 2 — Frontend Scaffold & Design System ✅ COMPLETE
*Goal: Empty shell with navigation, themes, and API client wired. No real data yet.*

- [x] **Step 19** — `frontend/` Vite scaffold: `npm create vite@latest frontend -- --template react-ts`, add proxy in `vite.config.ts` (`/api` + `/ws` → `localhost:9500`). Also set up Vitest + @ path alias.
- [x] **Step 20** — Tailwind CSS 4 install (upgraded from v3 to match shadcn v4) + `@tailwindcss/vite` plugin. Theme tokens registered via `@theme inline` in globals.css.
- [x] **Step 21** — `frontend/src/styles/tokens.css` + `globals.css` (see Design Tokens section above). shadcn/ui theme variables mapped to our custom tokens.
- [x] **Step 22** — Self-hosted fonts: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`. Import in `globals.css`.
- [x] **Step 23** — shadcn/ui v4 init (`base-nova` style, neutral base). 15 components installed: button card dialog dropdown-menu tabs tooltip input select switch separator scroll-area badge skeleton sheet table alert-dialog. (toast not available in base-nova — build custom later.)
- [x] **Step 24** — `src/lib/theme.ts` + `src/hooks/useTheme.ts` hook + `ThemeToggle.tsx`. 10 tests.
- [x] **Step 25** — `src/components/layout/`: `AppShell`, `Sidebar` (240px, nav, theme toggle + version footer), `Topbar` (56px, breadcrumbs), `Breadcrumb`. 8 tests.
- [x] **Step 26** — `src/router.tsx`: all routes defined with placeholder screens. 10 tests.
- [x] **Step 27** — `src/lib/api.ts`: typed fetch wrapper with auth support, ApiError class. 7 tests.
- [x] **Step 28** — `src/types/api.ts`: placeholder for `openapi-typescript` generation. `npm run gen:types` script configured.
- [x] **Step 29** — `src/lib/query-client.ts`: TanStack Query v5 provider (`staleTime: 30_000`, retry disabled for mutations). Wired into App.tsx with TooltipProvider.

**Deviation notes**: Tailwind upgraded from v3 to v4 (shadcn v4 requires it). `tailwind.config.ts` and `postcss.config.js` removed — config is in CSS via `@theme inline`. Total frontend tests: 35 passing.

### Phase 3 — All Screens (REST data, no WebSocket yet)
*Goal: Every screen rendered with real data from the Python backend API.*

- [x] **Step 30** — `OverviewScreen`: bento-ish server card grid, `ServerCard` with static status, empty state
- [x] **Step 31** — `ServerDetailScreen` shell + tab strip (URL-synced via `:tab` param)
- [x] **Step 32** — `InfoTab` + `ServerForm`: react-hook-form + zod, fields grouped into labeled cards (Identity, Passwords, Max Players, Persistent), inline validation, toast on save
- [x] **Step 33** — `MissionsTab` + `MissionRotationList`: dnd-kit drag-to-reorder rotation, per-mission param popover, available missions panel, `autoSelectMission` / `randomMissionOrder` toggles
- [x] **Step 34** — `ModsTab` + `ModsDualList`: dual-list keyboard move (Enter/Backspace), search filter on each side
- [x] **Step 35** — `DifficultyTab`: forcedDifficulty preset selector (Recruit/Regular/Veteran/Custom), when Custom: expand all 20+ `DifficultyOptions` flags as toggle switches + AI level sliders (`skillAI`, `precisionAI`)
- [x] **Step 36** — `NetworkTab`: `BandwidthPresetSelect` one-click preset (Home 1Mbps / VPS 10Mbps / Dedicated 100Mbps / Unlimited), then individual fields from `BasicConfigSchema` + `ServerConfigNetworkQuality` (ping/packetloss/desync kick thresholds) + `ServerConfigTimeouts` (voting/role/briefing/debriefing timeouts)
- [x] **Step 37** — `SecurityTab`: `verifySignatures`, `allowedFilePatching`, `filePatchingExceptions` (Steam UID list), `allowedLoadFileExtensions`, `BattlEye`, `admins[]` (Steam UID list), `kickDuplicate`, `serverCommandPassword`, `AntiFlood` settings
- [x] **Step 38** — `AdvancedTab`: `ServerConfigAdvanced` (timeStampFormat, statisticsEnabled, steamProtocolMaxDataSize, disableChannels, logFile), `ServerConfigLifecycle` (missionsToServerRestart, missionsToShutdown), `ServerConfigScripting` (onUserConnected, etc. — power-user text fields), `additionalConfigurationOptions` freeform textarea
- [x] **Step 39** — `HeadlessTab`: HC count, headlessClients/localClient IP fields
- [x] **Step 40** — `ModsScreen`: sortable table with mono font names, humanized size (tabular-nums), Steam metadata, AlertDialog delete confirm
- [x] **Step 41** — `MissionsScreen`: file list + `MissionUploadDropzone` (XHR with progress, not fetch) + `WorkshopImport` dialog
- [x] **Step 42** — `LogsScreen`: file table with download links
- [x] **Step 43** — `SettingsScreen`: read-only key/value cards
- [x] **Step 44** — `SteamCmdScreen`: server install/update UI, branch selector (stable/development), version display, update progress via WebSocket
- [x] **Step 44a** — `PresetsScreen`: dedicated Presets screen for the arma-modlist-tools pipeline:
  - `PresetUploadDropzone`: upload `.html` preset exports from Arma 3 Launcher
  - `PresetComparison`: shared vs unique mods breakdown table (grouped by shared/preset-unique); mod identity is steam_id-first, name fallback
  - `PresetLinkStatus`: per-group junction/symlink status with link/unlink actions
  - `PresetActions`: fetch from Caddy, sync-missing, update-mods, migrate groups, clean orphan folders — each streams progress via WebSocket pub/sub
  - `PresetMissingReport`: table of mods not yet on Caddy server (group-labelled; shows which subfolder they will land in when synced)
  - `PresetNameCheck`: diagnostic table of local folder name mismatches vs server canonical names (four-level matching: exact → case-insensitive → normalized → steam_id from meta.cpp), with suggested renames
  - Sidebar nav: "Presets" entry with folder icon between Logs and SteamCmd

### Phase 4 — WebSocket Live Data & Polish
*Goal: Real-time status updates working; UI feels designed, not default.*

- [x] **Step 45** — `src/lib/ws.ts`: single WebSocket instance, reconnect with exponential backoff + jitter, dispatches typed events
- [x] **Step 46** — `useServerStatus.ts`: subscribes to bus, patches TanStack Query cache via `queryClient.setQueryData`
- [x] **Step 47** — `StatusDot.tsx`: 2s `opacity` breath animation when online; static dim when offline; respects `prefers-reduced-motion`
- [x] **Step 48** — Sidebar pinned server list: live dots via `useServerStatus`
- [x] **Step 49** — Toasts: `useToast` for mutation results (server started/stopped, upload complete, SteamCMD update progress, errors)
- [x] **Step 50** — Skeleton placeholders while queries load (every screen)
- [x] **Step 51** — Empty states: icon + copy + CTA for each screen (Overview, Mods, Missions, Logs, SteamCmd)
- [x] **Step 52** — a11y pass: focus rings (accent color), `aria-label` on icon-only buttons, `<nav aria-label="Primary">`, keyboard reachability audit

### Phase 5 — Integration, Tests, CI ✅ COMPLETE
*Goal: Green CI on both backend and frontend; app deploys as a single process.*

- [x] **Step 53** — `app/main.py` static serving: mount `frontend/dist/assets` at `/assets`, catch-all returns `index.html` for non-API routes
- [x] **Step 54** — Backend integration tests: WebSocket smoke test, config writer output parity. Total backend tests grew from 82 → 288 during Phase 5 as coverage gaps were closed.
- [x] **Step 55** — Frontend unit tests (Vitest + RTL): DifficultyEditor flag toggling, BandwidthPresetSelect preset application, useServerStatus cache patching, ws.ts reconnect. 94 Vitest tests passing.
- [x] **Step 56** — Playwright E2E: `frontend/e2e/` — app.spec.ts, overview.spec.ts, server-detail.spec.ts, missions.spec.ts, steamcmd.spec.ts, websocket.spec.ts with API mock helpers in `e2e/helpers/api-mocks.ts`.
- [x] **Step 57** — Playwright screenshots: `frontend/e2e/screenshots.spec.ts` — all main screens, light + dark.
- [x] **Step 58** — axe-core a11y: `frontend/e2e/a11y.spec.ts` — zero serious violations gate.
- [x] **Step 59** — `scripts/migrate_servers_json.py`: CLI validator/migrator for existing `servers.json` files.
- [x] **Step 60** — `.github/workflows/ci.yml`:
  ```yaml
  jobs:
    backend:  ruff check, mypy, pytest --cov (gate ≥ 80%)
    frontend: npm ci, eslint, tsc --noEmit, vitest --coverage (gate ≥ 80%), vite build
    bundle:   fail if dist/assets/index-*.js gzip > 300 KB
  ```
- [x] **Step 61** — `CLAUDE.md` updated with all commands and non-obvious bugs. `README.md` completely rewritten for the Python stack.

### Phase 5 — Additional test files created to reach 80% coverage

These were added during test coverage work (not originally in the plan):

**Unit tests added:**
- `test_schemas_extra.py` — BasicConfigSchema, BANDWIDTH_PRESETS, all GameType values, ServerConfig sub-models, WsEnvelope
- `test_config_writers.py` — basic_config.py + profile_config.py writers (separate from test_config_writer.py)
- `test_domain_logs.py` — list_logs, get_log, delete_log, cleanup_old_logs
- `test_domain_mods.py` — list_mods() with real filesystem fixture, _folder_size, _read_steam_meta, _read_mod_file
- `test_a2s.py` — A2S query wrapper (AsyncMock for a2s.ainfo + a2s.aplayers)
- `test_pubsub.py` — EventBus publish/subscribe/overflow-drop behavior
- `test_steamcmd.py` — subprocess mock with AsyncMock stdout.readline
- `test_workshop.py` — httpx mocked with respx for Workshop API calls
- `test_mod_cleaner.py` — orphan folder detection, junction skip
- `test_mod_reporter.py` — missing report generation
- `test_mod_updater.py` — stale file re-download, local-only deletion
- `test_preset_compare.py` — compare_presets() shared/unique breakdown
- `test_auth.py` — HTTP Basic Auth, IP lockout (5 failures = 60s)

**Integration tests added:**
- `test_api_servers_extra.py` — update, config CRUD, start/stop edge cases
- `test_api_logs.py` — list, view, download, delete, OSError → 500
- `test_api_mods_settings.py` — GET /api/mods/ + GET /api/settings/
- `test_api_steamcmd.py` — install, update, branch, version
- `test_api_presets.py` — all 16 preset endpoints with `autouse` module-state reset fixture

---

## Full Arma 3 Config Coverage (new — not in original app)

The original Node.js app only surfaces ~16 server.cfg fields. The Arma 3 wiki documents **50+ server.cfg parameters**, a full **basic.cfg** (network tuning), and a **server profile** (.Arma3Profile) with 20+ difficulty flags. The rewrite should expose all of these, grouped logically, with sensible defaults.

### server.cfg — Full Schema

All parameters below map to the `server.cfg` file written before launching the server. Grouped by category; the UI should present them as labeled cards/sections within the Parameters tab.

```python
# app/schemas/server_config.py — Full server.cfg schema
# Groups mirror the wiki's logical categories

class ServerConfigIdentity(BaseModel):
    """Server identity & access — shown prominently in the form."""
    hostname: str                          # Server name in browser
    password: str | None = None            # Player join password
    passwordAdmin: str | None = None       # Admin login password (#login)
    serverCommandPassword: str | None = None  # serverCommand scripting password
    maxPlayers: int = 64                  # Max players including HC
    motd: list[str] = []                  # Welcome message lines
    motdInterval: float = 5.0             # Seconds between MOTD lines

class ServerConfigAdmin(BaseModel):
    """Admin & UID whitelisting."""
    admins: list[str] = []                # Steam UID whitelist for #login

class ServerConfigHeadless(BaseModel):
    """Headless client networking (also written to server.cfg)."""
    headlessClients: list[str] = []       # HC IP addresses
    localClient: list[str] = []           # Unlimited-bandwidth client IPs

class ServerConfigVoting(BaseModel):
    """Voting behavior."""
    voteThreshold: float = 0.5            # Fraction needed to confirm vote
    voteMissionPlayers: int = 1           # Players before mission vote screen
    allowedVoteCmds: list[dict] = []      # Vote command rules
    allowedVotedAdminCmds: list[dict] = []  # Voted-admin command rules

class ServerConfigNetworkQuality(BaseModel):
    """Network quality enforcement & kick rules."""
    kickDuplicate: int = 0               # Kick duplicate game IDs (0/1)
    loopback: int = 0                    # Force LAN mode (0/1)
    upnp: int = 0                        # UPNP port mapping (0/1)
    MaxPing: int = -1                     # Ping kick threshold (-1 = disabled)
    MaxPacketLoss: int = -1              # Packet loss kick threshold (%)
    MaxDesync: int = -1                  # Desync kick threshold
    DisconnectTimeout: int = 15           # Seconds before dropping lost client (1-90)
    kickClientsOnSlowNetwork: list[int] = [1, 1, 1, 1]  # {Ping, PacketLoss, Desync, Disconnect}: 0=log, 1=kick

class ServerConfigTimeouts(BaseModel):
    """Phase timeout configuration."""
    kickTimeout: list[list[int]] = [[0, 60], [1, 60], [2, 60], [3, 60]]  # {kickID, seconds}
    votingTimeOut: list[int] = [60, 90]  # {ready, notReady}
    roleTimeOut: list[int] = [90, 120]
    briefingTimeOut: list[int] = [60, 90]
    debriefingTimeOut: list[int] = [45, 60]
    lobbyIdleTimeout: int = 0            # Seconds before force-start (0 = disabled)

class ServerConfigVon(BaseModel):
    """Voice-over-network settings — more granular than the original boolean."""
    disableVoN: int = 0                   # 0=enabled, 1=disabled
    vonCodec: int = 1                     # 0=SPEEX, 1=OPUS
    vonCodecQuality: int = 3              # 1-30 (1-10=8kHz, 11-20=16kHz, 21-30=32/48kHz)

class ServerConfigSecurity(BaseModel):
    """Server hardening & file access control."""
    verifySignatures: int = 2            # 0=off, 1=v1+v2, 2=v2-only
    equalModRequired: int = 0            # Outdated but present
    allowedFilePatching: int = 0         # 0=none, 1=HC only, 2=all clients
    filePatchingExceptions: list[str] = []  # Steam UID whitelist for file patching
    allowedLoadFileExtensions: list[str] = []
    allowedPreprocessFileExtensions: list[str] = []
    allowedHTMLLoadExtensions: list[str] = []
    allowedHTMLLoadURIs: list[str] = []

class ServerConfigGameplay(BaseModel):
    """In-game behavior flags."""
    persistent: int = 0                  # Mission persists when players disconnect
    forcedDifficulty: str | None = None  # "Recruit"|"Regular"|"Veteran"|"Custom"
    skipLobby: bool = False
    allowProfileGlasses: bool = True
    drawingInMap: bool = True
    forceRotorLibSimulation: int = 0     # 0=player choice, 1=AFM, 2=SFM
    requiredBuild: int = 0              # Minimum client version
    autoSelectMission: bool = False
    randomMissionOrder: bool = False

class ServerConfigMissionRotation(BaseModel):
    """Mission cycle configuration."""
    missions: list[dict] | None = None   # Mission rotation list
    missionWhitelist: list[str] = []     # Limit admin mission changes

class ServerConfigLifecycle(BaseModel):
    """Server restart/shutdown automation."""
    missionsToServerRestart: int = 0     # Missions before process restart
    missionsToShutdown: int = 0          # Missions before process shutdown

class ServerConfigAntiFlood(BaseModel):
    """Chat flooding protection."""
    cycleTime: float = 0.5
    cycleLimit: int = 400
    cycleHardLimit: int = 4000
    enableKick: int = 0

class ServerConfigAdvanced(BaseModel):
    """Misc / advanced server.cfg settings."""
    steamProtocolMaxDataSize: int = 1024
    timeStampFormat: str = ""            # "none"|"short"|"full"
    statisticsEnabled: int = 1
    enablePlayerDiag: int = 0
    callExtReportLimit: int = 1000
    disableChannels: list[list] = []     # {channelID, text, voice}
    logFile: str = ""                    # Server console log path
    BattlEye: int = 1

class ServerConfigScripting(BaseModel):
    """Server-side scripting event hooks — power-user escape hatch."""
    onUserConnected: str = ""
    onUserDisconnected: str = ""
    doubleIdDetected: str = ""
    onHackedData: str = ""
    onDifferentData: str = ""
    onUnsignedData: str = ""
    onUserKicked: str = ""
    regularCheck: str = ""

# Composed schema for the full server.cfg
class ServerConfigFull(BaseModel):
    """Complete server.cfg model — all documented Arma 3 parameters."""
    model_config = ConfigDict(extra="allow")

    identity: ServerConfigIdentity = ServerConfigIdentity()
    admin: ServerConfigAdmin = ServerConfigAdmin()
    headless: ServerConfigHeadless = ServerConfigHeadless()
    voting: ServerConfigVoting = ServerConfigVoting()
    network_quality: ServerConfigNetworkQuality = ServerConfigNetworkQuality()
    timeouts: ServerConfigTimeouts = ServerConfigTimeouts()
    von: ServerConfigVon = ServerConfigVon()
    security: ServerConfigSecurity = ServerConfigSecurity()
    gameplay: ServerConfigGameplay = ServerConfigGameplay()
    mission_rotation: ServerConfigMissionRotation = ServerConfigMissionRotation()
    lifecycle: ServerConfigLifecycle = ServerConfigLifecycle()
    anti_flood: ServerConfigAntiFlood = ServerConfigAntiFlood()
    advanced: ServerConfigAdvanced = ServerConfigAdvanced()
    scripting: ServerConfigScripting = ServerConfigScripting()

    # Freeform append — maps to the existing additionalConfigurationOptions field
    additional_configuration_options: str | None = None
```

### basic.cfg — Network Performance Tuning Schema

These parameters live in the `Arma3.cfg` / `basic.cfg` file (specified via `-cfg` on the command line). They are **critical** for any server host with bandwidth constraints.

```python
# app/schemas/basic_config.py

class BasicConfigSchema(BaseModel):
    """basic.cfg / Arma3.cfg — network performance tuning."""
    model_config = ConfigDict(extra="allow")

    MaxMsgSend: int = 128               # Max packets per simulation cycle
    MaxSizeGuaranteed: int = 512        # Max guaranteed packet payload (bytes)
    MaxSizeNonguaranteed: int = 256      # Max non-guaranteed packet payload (bytes)
    MinBandwidth: int = 131072          # Guaranteed bandwidth (bps)
    MaxBandwidth: int = 10000000000     # Upper bandwidth bound (bps)
    MinErrorToSend: float = 0.001       # Min error to send distant updates
    MinErrorToSendNear: float = 0.01    # Min error to send near updates
    MaxCustomFileSize: int = 0          # Max custom face/sound size (bytes), 0=unlimited

    class SocketsConfig(BaseModel):
        maxPacketSize: int = 1400       # Max UDP packet size

    sockets: SocketsConfig = SocketsConfig()
```

**Bandwidth presets** for the UI (one-click config, then user can tweak individual values):

| Preset | MinBandwidth | MaxBandwidth | MaxMsgSend | Notes |
|--------|-------------|-------------|------------|-------|
| Home 1 Mbps | 131072 | 1000000 | 128 | Residential upload |
| VPS 10 Mbps | 768000 | 10000000 | 256 | Common VPS |
| Dedicated 100 Mbps | 5000000 | 100000000 | 512 | Dedicated server |
| Unlimited | 131072 | 10000000000 | 128 | Let engine decide |

### Server Profile — Difficulty Settings Schema

When `forcedDifficulty = "Custom"`, the server reads these from `USERNAME.Arma3Profile`. The rewrite should expose a difficulty editor.

```python
# app/schemas/server_profile.py

class DifficultyOptions(BaseModel):
    """Custom difficulty flags — stored in .Arma3Profile."""
    # Simulation
    reducedDamage: int = 0              # 0/1

    # Situational awareness (0=never, 1=limited distance, 2=always)
    groupIndicators: int = 0
    friendlyTags: int = 0
    enemyTags: int = 0
    detectedMines: int = 0
    commands: int = 1                   # 0=never, 1=fade out, 2=always
    waypoints: int = 1
    tacticalPing: int = 0              # 0=disable, 1=enable

    # Personal awareness
    weaponInfo: int = 2
    stanceIndicator: int = 2
    staminaBar: int = 0
    weaponCrosshair: int = 0
    visionAid: int = 0

    # View
    thirdPersonView: int = 0           # 0=disabled, 1=enabled, 2=vehicles only
    cameraShake: int = 1

    # Multiplayer
    scoreTable: int = 1
    deathMessages: int = 1
    vonID: int = 1

    # Misc
    mapContent: int = 0
    autoReport: int = 0
    multipleSaves: int = 0

class CustomAILevel(BaseModel):
    """AI skill when aiLevelPreset = 3 (Custom)."""
    skillAI: float = 0.5               # 0.0 - 1.0
    precisionAI: float = 0.5           # 0.0 - 1.0

class ServerProfileSchema(BaseModel):
    """Full .Arma3Profile schema."""
    model_config = ConfigDict(extra="allow")

    class DifficultyPresets(BaseModel):
        custom_difficulty: DifficultyOptions = DifficultyOptions()
        ai_level_preset: int = 3        # 0=Low, 1=Normal, 2=High, 3=Custom
        custom_ai_level: CustomAILevel = CustomAILevel()

    difficulty: DifficultyPresets = DifficultyPresets()
```

### SteamCMD Service

The original app has **no** server install/update capability. The rewrite should add this as a first-class feature.

```python
# app/services/steamcmd.py — Server binary management

class SteamCMDService:
    """Manages SteamCMD for server installation and updates."""

    async def install_server(self, game: str, path: str, branch: str = "public") -> None:
        """Install server files via SteamCMD.
        branch: "public" (stable) | "development" (dev)
        """

    async def update_server(self, game: str, path: str, branch: str = "public") -> None:
        """Update existing server installation."""

    async def get_installed_version(self, path: str) -> str | None:
        """Read current version from installed files."""

    async def download_workshop_item(self, item_id: int, path: str) -> None:
        """Download a Steam Workshop item (for mod install)."""

# Supported games with their Steam app IDs
STEAM_APP_IDS = {
    "arma3": 233780,        # Dedicated server package (free, no game ownership needed)
    "arma3_x64": 233780,    # Same package, x64 binary
    "arma2": 33910,
    "arma2oa": 33910,       # Same as arma2
    # ofp, cwa — not on SteamCMD
}
```

### Per-Game-Type Schema Variants

Different Arma games have different config capabilities. The schema should conditionally show/hide fields based on the game type.

```python
# app/schemas/game_types.py

class GameType(str, Enum):
    ARMA3 = "arma3"
    ARMA3_X64 = "arma3_x64"
    ARMA2OA = "arma2oa"
    ARMA2 = "arma2"
    ARMA1 = "arma1"
    OFP = "ofp"
    CWA = "cwa"
    OFP_RESISTANCE = "ofpresistance"

# Features available per game type
GAME_FEATURES = {
    "arma3": {
        "basic_cfg": True,          # Has basic.cfg
        "difficulty_profile": True, # Has .Arma3Profile difficulty
        "von_codec": True,          # OPUS codec option
        "headless_client": True,
        "workshop": True,           # Steam Workshop support
        "battleye": True,
        "anti_flood": True,         # class AntiFlood
        "advanced_options": True,   # class AdvancedOptions
        "scripting_hooks": True,
        "steamcmd_app_id": 233780,
    },
    "arma3_x64": {  # Same as arma3 but x64 binary
        **GAME_FEATURES["arma3"],
        "steamcmd_app_id": 233780,
    },
    "arma2oa": {
        "basic_cfg": True,
        "difficulty_profile": True,
        "von_codec": False,
        "headless_client": True,
        "workshop": False,
        "battleye": True,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": True,
        "steamcmd_app_id": 33910,
    },
    # ... older games have fewer features
}
```

### Config File Writing (domain layer)

The rewrite needs **three config writers** (the original only writes server.cfg):

```
app/domain/config_writer/
├── server_config.py     # Writes server.cfg from ServerConfigFull
├── basic_config.py      # Writes basic.cfg / Arma3.cfg from BasicConfigSchema
└── profile_config.py    # Writes USERNAME.Arma3Profile from ServerProfileSchema
```

Each writer must produce output that is **byte-compatible** with the `arma-server` npm package's output for the same input values, to allow golden-file testing.

### Preset Pipeline (from arma-modlist-tools)

The rewrite integrates the full [arma-modlist-tools](https://github.com/revernomad17/arma-modlist-tools) pipeline as an **alternative mod source** alongside SteamCMD. Where SteamCMD downloads mods directly from Steam, the preset pipeline downloads mods from a **self-hosted Caddy file server** and organizes them into junction/symlink groups.

**Data flow:**

```
Arma 3 Launcher .html preset exports
  └─ preset_parser.py      → parse HTML → Preset schemas (name, steam_id, source)
        └─ preset_compare.py  → shared vs unique mod breakdown → Comparison schema
              ├─ mod_fetcher.py    → download from Caddy HTTP server (with Basic Auth)
              │      └─ downloads/{group}/@ModName/
              ├─ mod_migrator.py   → move mod folders between groups on re-preset
              ├─ mod_cleaner.py    → find orphaned mod folders
              └─ mod_linker.py     → create/remove junctions/symlinks to arma_dir
```

**Key differences from SteamCMD:**
- SteamCMD downloads from Steam Workshop by ID — requires Steam Guard, throttled
- Caddy pipeline downloads pre-mirrored mod folders — fast, no Steam login, but requires a self-hosted server
- Both approaches can coexist: SteamCMD for initial setup, Caddy for fast bulk updates
- Junctions mean mods live in `downloads/` and are linked into `arma_dir/` — unlinking never deletes the source

**Caddy server configuration** (added to `app/core/config.py`):

```python
class CaddyConfig(BaseModel):
    """Self-hosted Caddy file server for mod downloads."""
    base_url: str = ""          # e.g. "https://your-server/arma3mods/"
    username: str = ""
    password: str = ""
```

When `caddy.base_url` is empty, the preset pipeline is disabled in the UI. When configured, the Presets screen becomes available as an alternative mod management path.

### Server Binary Launch (replaces `arma-server` npm `Server.start()`)

The `arma-server` npm package (v0.0.10) handles both config writing **and** process spawning. The rewrite splits these into `config_writer/` (above) and `app/services/process.py`.

**Game-to-executable mapping** (from `arma-server` npm `executables.js`):

| Game | Linux | Windows | Wine |
|------|-------|---------|------|
| arma1 | `server` | `arma_server.exe` | `arma_server.exe` |
| arma2 | `server` | `arma2server.exe` | `arma2server.exe` |
| arma2oa | `server` | `arma2oaserver.exe` | `arma2oaserver.exe` |
| arma3 | `arma3server` | `arma3server.exe` | `arma3server.exe` |
| arma3_x64 | `arma3server_x64` | `arma3server_x64.exe` | `arma3server_x64.exe` |
| cwa | *(no Linux binary)* | `coldwarassault_server.exe` | `coldwarassault_server.exe` |
| ofp | `server` | `ofp_server.exe` | `ofp_server.exe` |
| ofpresistance | `server` | `ofpr_server.exe` | `ofpr_server.exe` |

**Wine note:** Wine remaps to Windows executables — the spawned process is `wine <windows_exe_path>`.

**Server start command-line flags** (in order):

```
-mod=<semicolon-joined mod list>        # if mods non-empty
<custom parameters>                    # each entry from config + server parameters list
-port=<port>                           # if port specified
-serverMod=<semicolon-joined list>     # if serverMods non-empty
-filePatching                          # if enabled
-config=configs/<server_id>            # always, points to written server.cfg
```

Default parameters (if none specified): `['-noSound', '-world=empty']`.

**Headless client start command-line flags** (differs from server):

```
-connect=127.0.0.1                     # always, connects to main server
-mod=<semicolon-joined mod list>        # same mods as server
-password=<password>                   # if server has a password
<custom parameters>                    # same as server
-port=<port>                           # same port as server
-filePatching                          # if enabled
-client                                # always, marks as headless client
```

**Process spawning behavior:**
- `cwd` = `config.path` (the game installation directory)
- `env` = inherited from parent process
- On Wine: spawn `wine` as the executable with the Windows exe path as the first argument
- On close: clear `pid`, `state`, `instance`; stop headless clients; emit state change
- Status query: `python-a2s` every 5s (replaces Gamedig with same interval)
- Log capture: redirect stdout/stderr to log files (Linux only); Windows logs to `%LOCALAPPDATA%`

**Config file paths** (written before launch):
- `server.cfg` → `{config.path}/configs/{server_id}` (the `-config` flag points here)
- `basic.cfg` / `Arma3.cfg` → written if game supports it (see `game_types.py`)
- `.Arma3Profile` → written when `forcedDifficulty = "Custom"` (see `profile_config.py`)

---

## Critical Constraints (must not break)

### servers.json schema parity

The existing `servers.json` field names are a mix of conventions — **do not normalize them**. Reproduce exactly:

```python
# These field names are intentional — match the existing JSON exactly
class ServerSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    title: str
    port: int = 2302
    password: str | None = None
    admin_password: str | None = None
    max_players: int | None = None
    auto_start: bool = False
    battle_eye: bool = False
    von: bool = False
    persistent: bool = False
    verify_signatures: bool = False
    file_patching: bool = False
    allowed_file_patching: int = 1
    forcedDifficulty: str | None = None
    additionalConfigurationOptions: str | None = None
    number_of_headless_clients: int = 0
    motd: str | None = None
    mods: list[str] = []
    missions: list[dict] | None = None
    parameters: list[str] | None = None
```

**Runtime-only fields** (NOT persisted in `servers.json`, but included in API responses via `toJSON()`):

```python
# Added by the API layer when serializing server state
class ServerResponseSchema(ServerSchema):
    """API response shape — persisted fields + runtime state."""
    id: str                    # Slugified title (URL parameter)
    pid: int | None = None     # Process ID when running
    state: str = "stopped"     # "stopped" | "starting" | "running" | "stopping"
```

**Note:** The fields above are the **persisted** schema (what goes in `servers.json`). The **config output** schema (`ServerConfigFull` and friends) is what gets written to server.cfg / basic.cfg / .Arma3Profile. These are separate concerns: the persisted schema is minimal (backward-compatible), while the config output schema is comprehensive (full wiki coverage). The mapping between them is handled in `app/domain/server.py` — existing `servers.json` fields map to their new grouped homes, and new fields default to safe values so old data still works.

### REST API parity

All existing endpoints must respond with identical JSON shapes. Capture golden files from the current Node app before starting the backend:

```bash
# Run Node app and capture responses
curl http://localhost:9500/api/servers > tests/backend/fixtures/golden/servers.json
curl http://localhost:9500/api/mods    > tests/backend/fixtures/golden/mods.json
curl http://localhost:9500/api/missions > tests/backend/fixtures/golden/missions.json
curl http://localhost:9500/api/settings > tests/backend/fixtures/golden/settings.json
```

### Server ID generation

Server IDs are derived by slugifying the title (same as Node's `slugify`). Use `python-slugify` with identical options — dots replaced by hyphens. A wrong ID breaks log file paths and `servers.json` references.

```python
from slugify import slugify
server_id = slugify(title).replace('.', '-')
```

---

## Key Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `servers.json` schema drift breaks existing installations | HIGH | `ConfigDict(extra="allow")`, snapshot round-trip test, migrate validator script |
| Arma server launcher re-implementation is wrong | HIGH | Port arma-server npm source file-by-file, compare generated server.cfg + basic.cfg + .Arma3Profile against Node output |
| REST contract drift breaks frontend | HIGH | Golden-file parity tests run before any frontend work; include runtime fields (`id`, `pid`, `state`) in response schema |
| Config writer output differs from arma-server npm | HIGH | Golden-file test: write all 3 config files (server.cfg, basic.cfg, .Arma3Profile) and diff against Node-generated output |
| servers.json migration to grouped schema breaks | HIGH | Migrate script handles flat→grouped mapping; `extra="allow"` absorbs unknown fields; old flat fields still accepted on read |
| SteamCMD subprocess hangs or requires interactive auth | HIGH | SteamCMD requires Steam Guard code on first login — document the interactive auth flow; auto-detect Steam Guard prompts; timeout + clear error messaging |
| Mod scanning misses Creator DLCs | HIGH | Use exact glob `**/{@*,csla,ef,gm,rf,spe,vn,ws}/addons` — do not simplify to `@*/` |
| Process spawn wrong binary or flags per game/platform | HIGH | Use game-to-executable table from `arma-server` npm; test on Linux/Windows/Wine; headless client always gets `-client` flag |
| Per-game-type feature flags out of date with wiki | MEDIUM | `game_types.py` is the single source of truth; document which wiki version each game type was verified against; community PRs welcome |
| Design looks like default shadcn template | MEDIUM | Override tokens, mono font for identifiers, tabular-nums on data, tighten card padding |
| WebSocket cache shape mismatch causes stale UI | MEDIUM | Shared zod schemas between REST and WS payloads; typed cache-update helper; include `settings` in initial WS snapshot |
| Upload progress inconsistent across browsers | MEDIUM | Use `XMLHttpRequest` (not `fetch`) for .pbo uploads |
| Bundle > 300 KB gzip | MEDIUM | CI budget gate; dynamic import for dnd-kit + Workshop dialog |
| Difficulty editor UX overwhelming with 20+ toggles | MEDIUM | Collapsible sections (Simulation / Awareness / View / Multiplayer / Misc); preset buttons that fill common combos |
| Start/Stop API response shape drift | MEDIUM | Normalize to `{status: str, pid: int | None}`; support both legacy and new shapes during migration |
| a11y violations in drag-reorder | LOW | `@dnd-kit` has first-class keyboard reorder + live region announcements — enable them |
| Caddy file server unavailable or misconfigured | LOW | Pipeline is optional (`caddy.base_url` empty = disabled); clear error messages when server is unreachable; `sync_missing` can retry later |
| Junction creation fails on Linux without permissions | LOW | Check `os.symlink` capability at startup; fall back to copy with warning; document that `ln -s` or `mount --bind` may be needed |

---

## Dev Commands (once scaffold is complete)

```bash
# Backend (Python)
uv sync                              # install deps
uvicorn app.main:app --reload        # dev server on :9500

# Frontend
cd frontend
npm install
npm run dev                          # Vite dev on :9510, proxies /api + /ws to :9500
npm run gen:types                    # regenerate types from OpenAPI
npm run build                        # produces frontend/dist/

# Tests
pytest --cov=app --cov-report=term   # backend
cd frontend && npm run test          # frontend unit (Vitest)
cd frontend && npx playwright test   # E2E

# Lint
ruff check app/                      # backend
cd frontend && npm run lint          # frontend
```

---

## Session Resume Instructions

When resuming work on this plan in a new session:

1. Read this file (`PLAN.md`) first
2. Check which steps are ticked `[x]` vs unchecked `[ ]`
3. Read the current file tree under `app/` and `frontend/` to see what exists
4. Continue from the first unchecked step
5. Do NOT re-litigate framework decisions — they are final unless the user explicitly says to revisit

The `CLAUDE.md` file has the build/run commands. The golden fixture files in `tests/backend/fixtures/` are the source of truth for API contract.
