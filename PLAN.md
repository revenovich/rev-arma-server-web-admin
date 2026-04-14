# Python Rewrite Plan — arma-server-web-admin

**Branch**: `python-rewrite` (from `master`)
**Status**: Scaffold not started — use this document to resume without rescanning.

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
- Server detail uses a **horizontal tab strip** (Info / Missions / Mods / Parameters / Headless), tab state synced to URL

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
│   │   └── ws.py                 # /ws WebSocket endpoint
│   ├── domain/
│   │   ├── manager.py            # Replaces lib/manager.js — servers.json CRUD
│   │   ├── server.py             # Replaces lib/server.js — Server lifecycle
│   │   ├── missions.py           # Replaces lib/missions.js
│   │   ├── mods.py               # Replaces lib/mods/index.js
│   │   ├── logs.py               # Replaces lib/logs.js
│   │   └── settings.py           # Replaces lib/settings.js
│   ├── schemas/
│   │   ├── server.py             # Pydantic models — exact field parity with servers.json
│   │   ├── mission.py
│   │   ├── mod.py
│   │   ├── log.py
│   │   ├── settings.py
│   │   └── ws.py                 # WebSocket envelope: {type, serverId, payload}
│   └── services/
│       ├── pubsub.py             # Async fan-out pub/sub (asyncio.Queue per connection)
│       ├── a2s.py                # python-a2s wrapper (replaces Gamedig)
│       ├── workshop.py           # httpx + Steam Web API (replaces steam-workshop npm)
│       └── process.py            # asyncio subprocess mgmt (replaces arma-server npm)
│
├── frontend/                     ← React frontend (Vite)
│   ├── index.html
│   ├── vite.config.ts            # base:'/', outDir:'dist', dev proxy /api + /ws → :8000
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
│       │   │   ├── ServerForm.tsx          # react-hook-form + zod, 15+ fields
│       │   │   ├── MissionRotationList.tsx # dnd-kit drag-to-reorder
│       │   │   ├── ModsDualList.tsx        # dual-list with keyboard move + search
│       │   │   ├── ParametersList.tsx
│       │   │   └── HeadlessClientsPanel.tsx
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
│           │       ├── InfoTab.tsx
│           │       ├── MissionsTab.tsx
│           │       ├── ModsTab.tsx
│           │       ├── ParametersTab.tsx
│           │       └── HeadlessTab.tsx
│           ├── missions/MissionsScreen.tsx
│           ├── mods/ModsScreen.tsx
│           ├── logs/LogsScreen.tsx
│           └── settings/SettingsScreen.tsx
│
├── tests/
│   ├── backend/
│   │   ├── unit/
│   │   │   ├── test_manager_persistence.py  # CRITICAL: round-trip servers.json
│   │   │   ├── test_config_writer.py
│   │   │   ├── test_a2s_adapter.py
│   │   │   └── test_schemas.py
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

### Phase 1 — Backend Foundation
*Goal: Working FastAPI backend with all REST routes + WebSocket. Can be tested with curl before frontend exists.*

- [ ] **Step 1** — Branch exists (`python-rewrite`) ✓ DONE
- [ ] **Step 2** — `pyproject.toml` with all deps + ruff/mypy/pytest config
- [ ] **Step 3** — `.python-version` = `3.12`, `.gitignore` additions for Python artifacts
- [ ] **Step 4** — `app/core/config.py`: `pydantic-settings BaseSettings` mirroring all `config.js` keys: `game`, `path`, `port`, `host`, `type`, `prefix`, `suffix`, `admins`, `parameters`, `serverMods`, `auth`, `logFormat`, `additionalConfigurationOptions`
- [ ] **Step 5** — `app/core/paths.py`: resolve `servers.json`, mods dir (`{config.path}/@*/`), missions dir, logs dir
- [ ] **Step 6** — `app/schemas/*.py`: Pydantic models with **exact field names** from current `servers.json` (mix of snake_case and camelCase like `forcedDifficulty`, `additionalConfigurationOptions`, `auto_start`, `battle_eye`). Use `model_config = ConfigDict(extra="allow")` to guard against schema drift.
- [ ] **Step 7** — `app/domain/manager.py`: fully implement `load()` / `save()` with byte-compatible `servers.json` round-trip. **This is migration-critical** — test against real `servers.json` fixture first.
- [ ] **Step 8** — `app/domain/server.py`: Server class with `start()`, `stop()`, `update()`, `query_status()` stubs + `to_json()` matching existing `toJSON()` shape
- [ ] **Step 9** — `app/services/pubsub.py`: `EventBus` with `asyncio.Queue` per subscriber, `publish(topic, payload)` fan-out, bounded queue (drop oldest on back-pressure)
- [ ] **Step 10** — `app/api/ws.py`: `/ws` WebSocket endpoint — registers queue, sends initial snapshot (`{type: "missions", data: [...]}`), streams bus events. Envelope: `{"type": str, "serverId": str | None, "payload": Any}`
- [ ] **Step 11** — `app/services/a2s.py`: `python-a2s` wrapper returning `{online, players, maxPlayers, mission, map}`. Maps game type to A2S protocol. Returns `None` on timeout.
- [ ] **Step 12** — `app/domain/missions.py`, `mods.py`, `logs.py`, `settings.py`: implement file scanning logic ported from Node counterparts
- [ ] **Step 13** — `app/api/servers.py`: implement all 7 routes (`GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/start`, `POST /{id}/stop`)
- [ ] **Step 14** — `app/api/missions.py`, `mods.py`, `logs.py`, `settings.py`: implement all routes
- [ ] **Step 15** — `app/core/logging.py`: structlog config + Starlette middleware logging method/path/status/user (parity with morgan `:user` token)
- [ ] **Step 16** — `app/main.py`: app factory, startup ordering (load→scan→auto-start), static mount (`frontend/dist` if present, otherwise 200 placeholder)
- [ ] **Step 17** — `app/api/__init__.py`: auth dependency (`HTTPBasic` with constant-time compare against config)
- [ ] **Step 18** — Backend tests: `tests/backend/unit/test_manager_persistence.py` (snapshot round-trip), `test_schemas.py`, `tests/backend/integration/test_api_servers.py` (golden-file parity)

### Phase 2 — Frontend Scaffold & Design System
*Goal: Empty shell with navigation, themes, and API client wired. No real data yet.*

- [ ] **Step 19** — `frontend/` Vite scaffold: `npm create vite@latest frontend -- --template react-ts`, add proxy in `vite.config.ts` (`/api` + `/ws` → `localhost:8000`)
- [ ] **Step 20** — Tailwind install + `tailwind.config.ts` mapping all `--color-*` tokens to Tailwind theme. Import `tailwindcss-animate`.
- [ ] **Step 21** — `frontend/src/styles/tokens.css` + `globals.css` (see Design Tokens section above)
- [ ] **Step 22** — Self-hosted fonts: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`. Import in `globals.css`.
- [ ] **Step 23** — shadcn/ui init: `npx shadcn@latest init` (New York style, neutral base). Add: `button card dialog dropdown-menu tabs tooltip toast input select switch separator scroll-area badge skeleton sheet table alert-dialog`
- [ ] **Step 24** — `src/lib/theme.ts` + `useTheme.ts` hook + `ThemeToggle.tsx`
- [ ] **Step 25** — `src/components/layout/`: `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`
- [ ] **Step 26** — `src/router.tsx`: routes `/`, `/servers/:id`, `/servers/:id/:tab`, `/mods`, `/missions`, `/logs`, `/settings`
- [ ] **Step 27** — `src/lib/api.ts`: fetch wrapper with typed responses + zod parse at boundaries
- [ ] **Step 28** — `src/types/api.ts`: generate via `openapi-typescript` from `http://localhost:8000/openapi.json`. Add `npm run gen:types` script.
- [ ] **Step 29** — `src/lib/query-client.ts`: TanStack Query provider (`staleTime: 30_000`, retry disabled for mutations)

### Phase 3 — All Screens (REST data, no WebSocket yet)
*Goal: Every screen rendered with real data from the Python backend API.*

- [ ] **Step 30** — `OverviewScreen`: bento-ish server card grid, `ServerCard` with static status, empty state
- [ ] **Step 31** — `ServerDetailScreen` shell + tab strip (URL-synced via `:tab` param)
- [ ] **Step 32** — `InfoTab` + `ServerForm`: react-hook-form + zod, fields grouped into labeled cards (Identity, Network, Gameplay, Advanced), inline validation, toast on save
- [ ] **Step 33** — `MissionsTab` + `MissionRotationList`: dnd-kit drag-to-reorder rotation, per-mission param popover, available missions panel
- [ ] **Step 34** — `ModsTab` + `ModsDualList`: dual-list keyboard move (Enter/Backspace), search filter on each side
- [ ] **Step 35** — `ParametersTab` + `HeadlessTab`
- [ ] **Step 36** — `ModsScreen`: sortable table with mono font names, humanized size (tabular-nums), Steam metadata, AlertDialog delete confirm
- [ ] **Step 37** — `MissionsScreen`: file list + `MissionUploadDropzone` (XHR with progress, not fetch) + `WorkshopImport` dialog
- [ ] **Step 38** — `LogsScreen`: file table with download links
- [ ] **Step 39** — `SettingsScreen`: read-only key/value cards

### Phase 4 — WebSocket Live Data & Polish
*Goal: Real-time status updates working; UI feels designed, not default.*

- [ ] **Step 40** — `src/lib/ws.ts`: single WebSocket instance, reconnect with exponential backoff + jitter, dispatches typed events
- [ ] **Step 41** — `useServerStatus.ts`: subscribes to bus, patches TanStack Query cache via `queryClient.setQueryData`
- [ ] **Step 42** — `StatusDot.tsx`: 2s `opacity` breath animation when online; static dim when offline; respects `prefers-reduced-motion`
- [ ] **Step 43** — Sidebar pinned server list: live dots via `useServerStatus`
- [ ] **Step 44** — Toasts: `useToast` for mutation results (server started/stopped, upload complete, errors)
- [ ] **Step 45** — Skeleton placeholders while queries load (every screen)
- [ ] **Step 46** — Empty states: icon + copy + CTA for each screen (Overview, Mods, Missions, Logs)
- [ ] **Step 47** — a11y pass: focus rings (accent color), `aria-label` on icon-only buttons, `<nav aria-label="Primary">`, keyboard reachability audit

### Phase 5 — Integration, Tests, CI
*Goal: Green CI on both backend and frontend; app deploys as a single process.*

- [ ] **Step 48** — `app/main.py` static serving: mount `frontend/dist/assets` at `/assets`, catch-all returns `index.html` for non-API routes
- [ ] **Step 49** — Backend integration tests: golden-file parity against captured Node responses, WebSocket smoke test, upload endpoint
- [ ] **Step 50** — Frontend unit tests (Vitest + RTL): `ServerForm` validation, `ModsDualList` move logic, `useServerStatus` cache patching, `ws.ts` reconnect
- [ ] **Step 51** — Playwright E2E: create server, edit form, upload mission (mocked), toggle theme, WebSocket live update (mocked WS server), keyboard nav through sidebar + tabs
- [ ] **Step 52** — Playwright screenshots: 1280 and 1440, light and dark, for all 6 main screens (24 screenshots total)
- [ ] **Step 53** — axe-core a11y run in Playwright against every screen (zero serious violations gate)
- [ ] **Step 54** — `scripts/migrate_servers_json.py`: CLI that validates an existing `servers.json` against new Pydantic schemas, reports mismatches
- [ ] **Step 55** — `.github/workflows/ci.yml`:
  ```yaml
  jobs:
    backend:  ruff check, mypy, pytest --cov (gate ≥ 80%)
    frontend: npm ci, eslint, tsc --noEmit, vitest --coverage (gate ≥ 80%), vite build
    e2e:      build app, start uvicorn, run playwright
    bundle:   fail if dist/assets/index-*.js gzip > 300 KB
  ```
- [ ] **Step 56** — Update `CLAUDE.md` with Python + frontend dev commands, update `README.md`

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

### REST API parity

All existing endpoints must respond with identical JSON shapes. Capture golden files from the current Node app before starting the backend:

```bash
# Run Node app and capture responses
curl http://localhost:3000/api/servers > tests/backend/fixtures/golden/servers.json
curl http://localhost:3000/api/mods    > tests/backend/fixtures/golden/mods.json
curl http://localhost:3000/api/missions > tests/backend/fixtures/golden/missions.json
curl http://localhost:3000/api/settings > tests/backend/fixtures/golden/settings.json
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
| Arma server launcher re-implementation is wrong | HIGH | Port arma-server npm source file-by-file, compare generated server.cfg against Node output |
| REST contract drift breaks frontend | HIGH | Golden-file parity tests run before any frontend work |
| Design looks like default shadcn template | MEDIUM | Override tokens, mono font for identifiers, tabular-nums on data, tighten card padding |
| WebSocket cache shape mismatch causes stale UI | MEDIUM | Shared zod schemas between REST and WS payloads; typed cache-update helper |
| Upload progress inconsistent across browsers | MEDIUM | Use `XMLHttpRequest` (not `fetch`) for .pbo uploads |
| Bundle > 300 KB gzip | MEDIUM | CI budget gate; dynamic import for dnd-kit + Workshop dialog |
| a11y violations in drag-reorder | LOW | `@dnd-kit` has first-class keyboard reorder + live region announcements — enable them |

---

## Dev Commands (once scaffold is complete)

```bash
# Backend (Python)
uv sync                              # install deps
uvicorn app.main:app --reload        # dev server on :8000

# Frontend
cd frontend
npm install
npm run dev                          # Vite dev on :5173, proxies /api + /ws to :8000
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
