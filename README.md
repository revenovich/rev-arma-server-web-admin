# Arma Server Web Admin

A web-based admin panel for Arma Dedicated Servers. Manage multiple server instances, monitor live status, upload missions, handle mods, and stream server logs — all from a single UI.

> **Branch note**: This is the `python-rewrite` branch. The backend has been rewritten from Node.js/Express to **Python 3.12 + FastAPI**. The frontend is now **React 18 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui**. The `master` branch (original Node.js app) is unchanged and still deployable.

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
- HTTP Basic Auth with IP-based brute-force lockout

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

| Dependency | Minimum Version | Notes |
|------------|-----------------|-------|
| Python | **3.12** | Required. 3.11 will NOT work. |
| Node.js | **18** | For the frontend build only |
| npm | **9** | Bundled with Node.js 18 |
| pip / uv | any recent | For Python package management |

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
  "port": 3000,
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
| `port` | No | Web UI port (default `3000`). The FastAPI backend always starts on `8000` internally. |
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
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies all `/api` and `/ws` requests to the FastAPI backend at `http://localhost:8000`.

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
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI automatically serves the built frontend bundle from `frontend/dist/` at the root URL. The web UI is then available at `http://your-server:8000`.

### Tip: Run as a service (Linux systemd)

```ini
# /etc/systemd/system/arma-admin.service
[Unit]
Description=Arma Server Web Admin
After=network.target

[Service]
User=arma
WorkingDirectory=/opt/arma-server-web-admin
ExecStart=/usr/local/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
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

Current coverage: **80%+** (288 tests, 3 skipped for Linux-only symlink tests on Windows).

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

The app requires **Python 3.12 or newer**. Python 3.11 will fail at import time due to use of `type` statement syntax and other 3.12+ features.

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
| Frontend shows no data | Backend not running or CORS issue | Ensure `uvicorn` is running on port 8000 |
| `ModuleNotFoundError` on startup | Python 3.11 or older | Upgrade to Python 3.12+ |

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
