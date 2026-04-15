import type { Page, Route } from "@playwright/test";

// ── Fixtures ─────────────────────────────────────────────────────────────────

export const mockServer = {
  id: "server-1",
  title: "My Arma Server",
  port: 2302,
  password: null,
  admin_password: null,
  auto_start: false,
  battle_eye: true,
  file_patching: false,
  forcedDifficulty: "Regular",
  max_players: 64,
  missions: [],
  mods: [],
  motd: null,
  number_of_headless_clients: 0,
  parameters: [],
  persistent: false,
  von: true,
  verify_signatures: 2,
  additionalConfigurationOptions: null,
  pid: null,
  state: null,
};

export const mockMod = {
  name: "@ace",
  size: 1_048_576,
  formattedSize: "1.0 MB",
  modFile: null,
  steamMeta: null,
};

export const mockMission = {
  name: "altis_life.Altis.pbo",
  missionName: "altis_life.Altis",
  worldName: "Altis",
  size: 524_288,
  sizeFormatted: "512 KB",
  dateCreated: "2024-01-01",
  dateModified: "2024-01-01",
};

export const mockLog = {
  name: "arma3server_2024-01-01.rpt",
  path: "/logs/arma3server_2024-01-01.rpt",
  size: 2_048,
  formattedSize: "2.0 KB",
  created: "2024-01-01T00:00:00Z",
  modified: "2024-01-01",
};

export const mockSettings = {
  game: "arma3",
  path: "/opt/arma3",
  port: 2302,
  type: "arma3",
};

export const mockSteamCmdVersion = {
  version: "1.0.0",
  installed: true,
};

export const mockPreset = {
  id: "preset-1",
  name: "Default Preset",
  mods: [{ name: "@ace", steamId: "463939057", directoryName: "@ace" }],
};

// ── Helper: check if URL path is a list endpoint (no sub-path after /servers/) ──

function isListEndpoint(pathname: string, prefix: string): boolean {
  // Match /api/servers or /api/servers/ but NOT /api/servers/server-1/info
  const after = pathname.slice(prefix.length);
  return after === "" || after === "/";
}

// ── Route mock setup ─────────────────────────────────────────────────────────

interface MockOverrides {
  servers?: unknown[];
  server?: unknown;
  mods?: unknown[];
  missions?: unknown[];
  logs?: unknown[];
  settings?: unknown;
  steamcmd?: unknown;
}

export async function mockApiRoutes(page: Page, overrides: MockOverrides = {}) {
  const {
    servers = [mockServer],
    server = mockServer,
    mods = [mockMod],
    missions = [mockMission],
    logs = [mockLog],
    settings = mockSettings,
    steamcmd = mockSteamCmdVersion,
  } = overrides;

  // Auth — bypass login by default (no auth required)
  await page.route("**/api/auth**", (route: Route) => {
    return route.fulfill({ json: { auth_required: false } });
  });

  // All server routes — handle list vs individual vs sub-actions in one handler
  await page.route("**/api/servers**", (route: Route) => {
    const url = route.request().url();
    const pathname = new URL(url).pathname;
    const method = route.request().method();

    // List endpoints: GET /api/servers/ → return array
    if (isListEndpoint(pathname, "/api/servers")) {
      if (method === "GET") {
        return route.fulfill({ json: servers });
      }
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        return route.fulfill({ json: { ...mockServer, ...body, id: "new-server" } });
      }
    }

    // Sub-actions: /start, /stop
    if (pathname.endsWith("/start") && method === "POST") {
      return route.fulfill({ json: { status: "ok", pid: 12345 } });
    }
    if (pathname.endsWith("/stop") && method === "POST") {
      return route.fulfill({ json: { status: "ok", pid: null } });
    }

    // Individual server: PUT /api/servers/server-1
    if (method === "PUT") {
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      return route.fulfill({ json: { ...mockServer, ...body } });
    }

    // Delete: DELETE /api/servers/server-1
    if (method === "DELETE") {
      return route.fulfill({ status: 204, body: "" });
    }

    // GET individual server
    return route.fulfill({ json: server });
  });

  await page.route("**/api/mods**", (route: Route) => {
    return route.fulfill({ json: mods });
  });

  await page.route("**/api/missions**", (route: Route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: missions });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({ json: { status: "ok" } });
    }
    return route.continue();
  });

  await page.route("**/api/logs**", (route: Route) => {
    return route.fulfill({ json: logs });
  });

  await page.route("**/api/settings**", (route: Route) => {
    return route.fulfill({ json: settings });
  });

  await page.route("**/api/presets**", (route: Route) => {
    return route.fulfill({ json: [mockPreset] });
  });

  await page.route("**/api/steamcmd/**", (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/version")) {
      return route.fulfill({ json: steamcmd });
    }
    if (
      (url.endsWith("/install") || url.endsWith("/update") || url.endsWith("/branch")) &&
      method === "POST"
    ) {
      return route.fulfill({ json: { status: "ok" } });
    }
    return route.continue();
  });
}

/**
 * Intercepts the /ws WebSocket connection and returns a handle so tests
 * can push messages into the page via `wsMock.send(...)`.
 */
export async function mockWebSocket(page: Page) {
  type WsSend = (message: string) => void;
  let sendToPage: WsSend | null = null;

  await page.routeWebSocket("**/ws", (ws) => {
    sendToPage = (msg: string) => ws.send(msg);
    ws.onMessage(() => {
      // absorb messages from page (client → server direction)
    });
  });

  return {
    send(event: { type: string; serverId: string | null; payload: unknown }) {
      if (sendToPage) {
        sendToPage(JSON.stringify(event));
      }
    },
  };
}