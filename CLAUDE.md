# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run the app
npm start

# Run all tests
npm test

# Run a single test file
node node_modules/mocha/bin/mocha test/lib/server.js

# Lint
npm run lint

# Install as Windows Service
npm run install-windows-service

# Uninstall Windows Service
npm run uninstall-windows-service
```

## Setup

Copy `config.js.example` to `config.js` and set the required values (`game`, `path`, `port`, `type`). The app will not start without `config.js`.

Server instances are persisted to `servers.json` in the project root. This file is auto-created on first server save.

## Architecture

This is a Node.js/Express backend with a Backbone.js + Marionette SPA frontend. The server and client communicate via both REST API and Socket.io (real-time state push).

### Backend (`app.js` entry point)

- **`lib/manager.js`** — manages the collection of server instances; persists to `servers.json`; emits `servers` events on state change
- **`lib/server.js`** — wraps `arma-server` package; handles start/stop, headless clients, and periodic game server status polling via Gamedig (every 5s)
- **`lib/mods/index.js`** — scans the game directory for mod folders (glob pattern `**/{@*,csla,ef,gm,rf,spe,vn,ws}/addons`); reads Steam Workshop metadata and mod file data
- **`lib/missions.js`** — manages mission `.pbo` files
- **`lib/logs.js`** — handles server process log file I/O
- **`lib/settings.js`** — exposes read-only public config to the frontend
- **`routes/`** — Express routers for `/api/logs`, `/api/missions`, `/api/mods`, `/api/servers`, `/api/settings`

### Real-time updates

Socket.io pushes `missions`, `mods`, and `servers` events to all connected clients whenever state changes. The frontend collections subscribe to these events to re-render without polling.

### Frontend (`public/`)

Built with Webpack 1.x (old; no hot reload). Entry point is `public/js/app.js`. The SPA uses Backbone.Marionette with a router in `public/js/app/router.js`. Views are nested under `public/js/app/views/` matching the URL hierarchy:

- `servers/` — server list, form, status info, and nested missions/mods/parameters management
- `mods/` — global mods list
- `missions/` — mission upload and Workshop download
- `logs/` — log file list and download

Webpack bundles are served via `webpack-dev-middleware` in development (no separate build step needed).

### Server ID generation

Server IDs are derived by slugifying the server title (e.g. `"My Server"` → `"my-server"`). Renaming a server changes its ID, which affects log file paths and `servers.json` references.

## Testing

Tests use Mocha + Supertest. Test files live in `test/`. The test suite requires no config setup — `test/app.js` imports `app.js` directly. Linting uses `standard` (no config file needed; rules in `package.json`).
