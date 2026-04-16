# Arma Server Web Admin

A web-based admin panel for Arma Dedicated Servers. Manage multiple server instances, monitor live status, upload missions, handle mods, and stream server logs — all from a single UI.

> **Branch note**: This is the `python-rewrite` branch. The backend has been rewritten from Node.js/Express to **Python 3.9+ FastAPI**. The frontend is now **React 18 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui**. The `master` branch (original Node.js app) is unchanged and still deployable.

---

## Features

- Manage multiple Arma server instances from one panel
- Live server status via A2S query (players, mission, map)
- Upload missions from local computer or Steam Workshop
- Manage and link mods (supports Windows NTFS junctions and Linux symlinks)
- Stream and download server `.rpt` log files
- Preset management — parse, compare, and sync Arma Launcher HTML presets
- SteamCMD integration for server installs and updates
- WebSocket-based live updates (no polling)
- Custom login screen with HTTP Basic Auth and IP-based brute-force lockout (dark mode by default)

---

## Supported Games

| Value | Game |
|-------|------|
| `arma3_x64` | Arma 3 (64-bit, recommended) |
| `arma3` | Arma 3 (32-bit) |
| `arma2oa` | Arma 2: Operation Arrowhead |
| `arma2` | Arma 2 |
| `arma1` | Arma 1 |
| `ofp` | Operation Flashpoint |
| `ofpresistance` | OFP: Resistance |
| `cwa` | Cold War Assault (Linux not supported) |

---

## Supported Platforms

| Value | Description |
|-------|-------------|
| `linux` | Native Linux server |
| `windows` | Native Windows server |
| `wine` | Windows binary running under Wine on Linux |

---

## Requirements

| Dependency | Minimum Version | Recommended | Notes |
|------------|-----------------|-------------|-------|
| Python | **3.9** | 3.12 | Required. 3.8 will NOT work. |
| Node.js | **18** | **20 LTS** | Frontend build only. **Node 14/16 will NOT work** — many deps require >= 18. |
| npm | **9** | 10 | Bundled with Node.js 18+ |
| pip / uv | any recent | uv | For Python package management |

> **Windows Server 2016 users**: Node.js 14.x (bundled with some older installs) is NOT supported. Install Node.js 20 LTS from https://nodejs.org/ before running `npm install`. Node.js 20 runs fine on Windows Server 2016.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/revenovich/rev-arma-server-web-admin.git
cd rev-arma-server-web-admin
git checkout python-rewrite
```

### 2. Install Python backend dependencies

**Option A — pip (standard)**

```bash
pip install -e .
```

This installs all runtime dependencies declared in `pyproject.toml`.

**Option B — pip (explicit, no editable install)**

```bash
pip install fastapi "uvicorn[standard]" pydantic pydantic-settings python-a2s \
            python-multipart httpx python-slugify humanize structlog aiofiles watchfiles
```

**Option C — uv (recommended for development)**

```bash
pip install uv
uv sync           # installs runtime + dev dependencies
```

Dev dependencies (for testing) include `pytest`, `pytest-asyncio`, `pytest-cov`, `respx`, `ruff`, `mypy`.

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Configuration

### 1. Copy the example config

```bash
cp config.json.example config.json
```

### 2. Edit `config.json`

```json
{
  "game": "arma3_x64",
  "path": "/opt/arma3",
  "port": 9500,
  "host": "0.0.0.0",
  "type": "linux",
  "additionalConfigurationOptions": "",
  "parameters": ["-noSound", "-world=empty"],
  "serverMods": [],
  "admins": [],
  "auth": {
    "username": "",
    "password": ""
  },
  "prefix": "",
  "suffix": "",
  "caddy": {
    "base_url": "",
    "username": "",
    "password": ""
  }
}
```

| Key | Required | Description |
|-----|----------|-------------|
| `game` | Yes | Game type — see Supported Games table above |
| `path` | Yes | **Absolute** path to the game server directory (where the server binary lives) |
| `port` | No | Web UI port (default `9500`). **Note:** This is the web admin port, not the game server port. Each Arma server instance has its own game port (default `2302`) configured in the server settings. |
| `host` | No | IP/hostname to bind the web server to (default `0.0.0.0`) |
| `type` | Yes | Platform type: `linux`, `windows`, or `wine` |
| `additionalConfigurationOptions` | No | Raw text appended to `server.cfg` |
| `parameters` | No | Extra CLI parameters passed to every server on start |
| `serverMods` | No | Mods loaded as server-only mods (not sent to clients) |
| `admins` | No | Array of Steam64 IDs with in-game admin rights |
| `auth.username` | No | HTTP Basic Auth username. **Leave both empty to disable auth.** |
| `auth.password` | No | HTTP Basic Auth password |
| `prefix` | No | Text prepended to all server names |
| `suffix` | No | Text appended to all server names |
| `caddy.base_url` | No | Base URL of a Caddy server hosting mod files (required for preset mod download features) |
| `caddy.username` | No | Caddy HTTP Basic Auth username |
| `caddy.password` | No | Caddy HTTP Basic Auth password |

> **Important**: The app starts without `config.json` but `path` will be empty — mods, missions, and log scanning won't work.

---

## Migrating from the Node.js Version

If you are currently running the original Node.js/Express version of this app and want to switch to the Python rewrite on **Windows Server 2016** (or any platform), follow these steps. Your existing Arma servers and mods are safe — the new app reads the same `servers.json` and the same mod folders.

### Step 1: Stop the old app

```bash
# If running via npm/Node:
npm stop
# Or kill the Node.js process
taskkill /F /IM node.exe /FI "WINDOWTITLE eq arma-server-web-admin"
```

### Step 2: Back up your data

```powershell
# Back up the existing config and server list
copy config.json config.json.bak
copy servers.json servers.json.bak
```

### Step 3: Install Python 3.9+ and the new app

```powershell
# Install Python 3.9+ from python.org if not already installed
# Then:
cd D:\path\to\rev-arma-server-web-admin
pip install -e .
```

### Step 4: Migrate your existing config.json

The new app's `config.json` is **almost identical** to the old Node.js `config.js`. The only changes:

1. Rename `config.js` → `config.json` (or copy from `config.json.example`)
2. Set `"type": "windows"` (the old app used `"type": "windows"` too)
3. Set `"path"` to your Arma server directory (same path as before)

Example `config.json` for Windows:

```json
{
  "game": "arma3_x64",
  "path": "D:\\Arma3Server",
  "port": 9500,
  "host": "0.0.0.0",
  "type": "windows",
  "additionalConfigurationOptions": "",
  "parameters": ["-noSound", "-world=empty"],
  "serverMods": [],
  "admins": [],
  "auth": {
    "username": "",
    "password": ""
  },
  "prefix": "",
  "suffix": "",
  "logFormat": "dev",
  "caddy": {
    "base_url": "",
    "username": "",
    "password": ""
  }
}
```

> **Key differences from old config.js**: The `port` field is now the **web UI port** (default 9500), not the game server port. Game server ports are configured per-server inside the UI (default 2302). The old `port` field served the same purpose (Express listen port), so just update the number.

### Step 5: Validate your servers.json

Your existing `servers.json` file works as-is. The new app's Pydantic schema preserves all field names (including mixed camelCase/snake_case like `forcedDifficulty`, `additionalConfigurationOptions`, `battle_eye`) and allows extra fields, so no data loss.

Run the migration validator to confirm:

```bash
python scripts/migrate_servers_json.py servers.json
```

If any issues are found, fix them with:

```bash
python scripts/migrate_servers_json.py servers.json --migrate -o servers.json.new
```

Then replace `servers.json` with the validated version.

### Step 6: Build the frontend and start

```bash
cd frontend
npm install
npm run build
cd ..

uvicorn app.main:app --host 0.0.0.0 --port 9500
```

The web UI is available at `http://your-server:9500`.

### Step 7: Verify existing mods

Your mods are still in the same directory structure. The new app scans mod folders using the same `@*` and Creator DLC glob pattern. Open the web UI and check:

- **Servers** → your existing servers should appear with their configurations intact
- **Mods** → all mod folders should be listed
- **Missions** → all `.pbo` files in `mpmissions/` should appear

> **Important for Windows**: The new app uses **NTFS junctions** (same as the old app) for mod linking. Never use `shutil.rmtree()` on a junction — it deletes the actual mod files. The app handles this correctly internally.

### Step 8: Set up Caddy for mod downloads (optional)

If you use the preset/mod download pipeline (arma-modlist-tools replacement), configure the Caddy integration in `config.json`:

```json
"caddy": {
  "base_url": "https://your-caddy-server.example.com",
  "username": "caddy_user",
  "password": "caddy_password"
}
```

This enables: preset import from `.html` files, missing mod reports, and mod download/sync.

### Step 9: Set up as a Windows Service (optional)

To run the app automatically on startup, use **nssm** (Non-Sucking Service Manager):

```powershell
# Download nssm from https://nssm.cc/download
nssm install ArmaAdmin "C:\Python39\python.exe" "-m uvicorn app.main:app --host 0.0.0.0 --port 9500"
nssm set ArmaAdmin AppDirectory "D:\path\to\rev-arma-server-web-admin"
nssm set ArmaAdmin DisplayName "Arma Server Web Admin"
nssm start ArmaAdmin
```

> **CRITICAL on Windows**: Disable Windows Error Reporting before running Arma servers through this (or any) web admin. See the [Windows: Disable Windows Error Reporting](#windows-disable-windows-error-reporting) section below.

### Environment variable overrides

Every config key can be overridden via environment variables with the `ARMA_` prefix:

| Env var | Config key |
|---------|-----------|
| `ARMA_GAME` | `game` |
| `ARMA_PATH` | `path` |
| `ARMA_PORT` | `port` |
| `ARMA_HOST` | `host` |
| `ARMA_TYPE` | `type` |
| `ARMA_AUTH__USERNAME` | `auth.username` |
| `ARMA_AUTH__PASSWORD` | `auth.password` |
| `ARMA_CADDY__BASE_URL` | `caddy.base_url` |
| `ARMA_CADDY__USERNAME` | `caddy.username` |
| `ARMA_CADDY__PASSWORD` | `caddy.password` |

Environment variables take precedence over `config.json` values.

---

## Running (Development)

Open two terminals:

**Terminal 1 — Backend**

```bash
uvicorn app.main:app --reload --port 9500
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

The Vite dev server runs on `http://localhost:9510` and proxies all `/api` and `/ws` requests to the FastAPI backend at `http://localhost:9500`.

---

## Running (Production)

### 1. Build the frontend

```bash
cd frontend
npm run build
cd ..
```

This outputs static files to `frontend/dist/`.

### 2. Start the backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 9500
```

FastAPI automatically serves the built frontend bundle from `frontend/dist/` at the root URL. The web UI is then available at `http://your-server:9500`.

### Tip: Run as a service (Linux systemd)

```ini
# /etc/systemd/system/arma-admin.service
[Unit]
Description=Arma Server Web Admin
After=network.target

[Service]
User=arma
WorkingDirectory=/opt/arma-server-web-admin
ExecStart=/usr/local/bin/uvicorn app.main:app --host 0.0.0.0 --port 9500
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now arma-admin
```

---

## Docker

```sh
mkdir -p arma3 profiles
touch servers.json

docker run \
  --network=host \
  --env ARMA_GAME=arma3_x64 \
  --env ARMA_PATH=/arma3 \
  --env ARMA_TYPE=linux \
  --volume $PWD/arma3:/arma3 \
  --volume $PWD/servers.json:/app/servers.json \
  --volume $PWD/profiles:"/root/.local/share/Arma 3 - Other Profiles" \
  dahlgren/arma-server-web-admin
```

| Environment Variable | Description |
|----------------------|-------------|
| `ARMA_GAME` | Game type (e.g. `arma3_x64`) |
| `ARMA_PATH` | Absolute path to game server inside the container |
| `ARMA_TYPE` | `linux`, `windows`, or `wine` |
| `ARMA_AUTH__USERNAME` | HTTP Basic Auth username |
| `ARMA_AUTH__PASSWORD` | HTTP Basic Auth password |

Mount `servers.json` to persist server configurations across container restarts.

---

## Testing

```bash
# Run all backend tests
python -m pytest tests/ -q

# Run with coverage report
python -m pytest tests/ -q --cov=app --cov-report=term-missing

# Run a specific test file
python -m pytest tests/backend/unit/test_manager_persistence.py -v

# Run frontend tests
cd frontend && npm run test

# Type-check frontend
cd frontend && npm run typecheck
```

Current coverage: **80%+** backend (338 tests, 3 skipped for Linux-only symlink tests on Windows) and **85%+** frontend (447 Vitest tests).

---

## Important Warnings and Setup Notes

### Windows: Disable Windows Error Reporting

> **CRITICAL**: If Windows Error Reporting is enabled, a crashing Arma server will show a crash dialog that blocks the process. The admin panel will show the server as "running" indefinitely and Stop will not work.

Disable it via Group Policy or registry:

```
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\Windows Error Reporting
Value: Disabled = 1
```

Or via PowerShell (administrator):

```powershell
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting" -Name "Disabled" -Value 1
```

### Wine: Disable GUI Crash Dialog

> **CRITICAL**: If the Wine crash dialog is enabled, a crashing Windows Arma binary under Wine will open a dialog that blocks the process indefinitely.

Disable it with winetricks:

```bash
winetricks nocrashdialog
```

Or manually via the Wine registry:

```bash
wine regedit
# Navigate to: HKEY_CURRENT_USER\Software\Wine\WineDbg
# Add DWORD: ShowCrashDialog = 0
```

See [Wine FAQ](http://wiki.winehq.org/FAQ#head-c857c433cf9fc1dcd90b8369ef75c325483c91d6) for details.

### Windows: NTFS Junctions (Mod Linking)

The mod linker uses **Windows NTFS junctions** (not symlinks) to link mod folders into the game directory. This is important:

- **Never** use `shutil.rmtree()` on a junction — it will delete the actual mod files in the source directory.
- `os.path.islink()` returns `False` for junctions — the app uses `lstat()` with file attribute checks instead.
- Junction creation requires no elevated privileges on Windows (unlike symlinks).
- Junctions are removed with `os.rmdir()`, not `os.unlink()`.

These are handled correctly by the app internally. You do not need to do anything. **Do not use external tools to delete mod link folders unless you know they handle junctions correctly.**

### HTTP Basic Auth Lockout

If `auth.username` and `auth.password` are both set, the admin panel is protected by HTTP Basic Auth with an IP-based brute-force lockout:

- **5 consecutive failed login attempts** from the same IP triggers a **60-second lockout**.
- During lockout, the IP receives `429 Too Many Requests` regardless of credentials.
- The lockout resets automatically after 60 seconds.
- Lockout state is in-memory and resets on server restart.

> If you lock yourself out: restart the backend process or wait 60 seconds.

### Mod Download Feature (Caddy)

The preset management → mod download pipeline requires a **Caddy file server** hosting your mod files. Without `caddy.base_url` configured, these endpoints return `400`:

- `POST /api/presets/fetch`
- `POST /api/presets/sync-missing`
- `POST /api/presets/update-mods`
- `GET /api/presets/missing-report`
- `GET /api/presets/check-names`

All other features (server management, missions, logs, settings) work without Caddy.

### Log Retention (Linux only)

On Linux, the app automatically keeps the **20 most recent** `.rpt` log files in the `logs/` subdirectory of the game path. Older files are deleted automatically on each server start. This cleanup does not run on Windows or Wine.

### servers.json Location

Server configurations are persisted to `servers.json` in the **working directory** where you start uvicorn. If you start the server from different directories, it will create separate `servers.json` files and appear to have different server lists.

> Always start uvicorn from the same directory (the repo root) or set a working directory in your service unit file.

### path Must Be Absolute

The `path` config key (and `ARMA_PATH` env var) must be an **absolute path** to the game server directory. Relative paths will cause mod scanning, mission listing, and log streaming to silently fail.

### Python Version

The app requires **Python 3.9 or newer**.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Mods list is empty | `path` is wrong or game dir doesn't exist | Check `path` in config.json points to the Arma server folder |
| Missions list is empty | `path` wrong or no `.pbo` files in `mpmissions/` | Verify the path and that missions are uploaded |
| Logs tab is empty | Linux-only feature; `logs/` subdir doesn't exist | Create `<path>/logs/` or start the server once to generate logs |
| Server stuck "running" after crash (Windows) | Windows Error Reporting dialog blocking process | Disable WER — see warning above |
| Server stuck "running" after crash (Wine) | Wine crash dialog blocking process | Run `winetricks nocrashdialog` |
| `429 Too Many Requests` on login | IP brute-force lockout triggered | Wait 60 seconds or restart the backend |
| Mod download endpoints return 400 | `caddy.base_url` not set | Configure Caddy integration or ignore these features |
| Login screen doesn't appear / "Failed to load servers" shown | Auth is configured but the frontend dist is stale | Rebuild: `cd frontend && npm run build` |
| Login screen doesn't appear / shows full app | Auth credentials exist in `sessionStorage` from a previous session | Open DevTools → Application → Session Storage → clear `arma_auth` key |
| Frontend shows no data | Backend not running or CORS issue | Ensure `uvicorn` is running on port 9500 |
| `ModuleNotFoundError` on startup | Python 3.8 or older | Upgrade to Python 3.9+ |

---

## Development

```bash
# Backend linting
ruff check app/ tests/

# Backend type checking
mypy app/

# Frontend linting
cd frontend && npm run lint

# Generate TypeScript types from OpenAPI (backend must be running)
cd frontend && npm run gen:types

# Frontend build check
cd frontend && npm run build
```

---

## Project Structure

```
.
├── app/                    # FastAPI backend
│   ├── api/                # HTTP route handlers
│   ├── core/               # Config, paths, logging
│   ├── domain/             # Business logic (server, manager, mods, logs, missions)
│   ├── schemas/            # Pydantic v2 models
│   ├── services/           # External integrations (SteamCMD, A2S, WebSocket bus, Caddy)
│   └── main.py             # App factory (create_app)
├── frontend/               # React 18 + Vite + TypeScript frontend
│   ├── src/
│   │   ├── features/       # Feature screens (servers, missions, logs, etc.)
│   │   ├── components/     # Shared UI components + shadcn/ui copies
│   │   ├── hooks/          # TanStack Query hooks
│   │   └── lib/            # api.ts, ws.ts, theme.ts
│   └── e2e/                # Playwright E2E tests
├── tests/                  # Backend pytest tests
│   └── backend/
│       ├── unit/           # Unit tests (no HTTP, no filesystem side-effects)
│       └── integration/    # Integration tests (FastAPI TestClient)
├── config.json.example     # Config template
├── pyproject.toml          # Python project metadata + tool config
└── PLAN.md                 # Full architecture decisions and phase checklist
```
