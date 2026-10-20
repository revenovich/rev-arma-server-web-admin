import { describe, it, expect, beforeEach, vi } from "vitest";
import { api, ApiError, errorMessage } from "@/lib/api";

describe("api fetch wrapper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes GET request and returns parsed JSON", async () => {
    const data = [{ id: "1", hostname: "Test Server" }];
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response),
    );

    const result = await api.get<{ id: string; hostname: string }[]>(
      "/api/servers",
    );
    expect(result).toEqual(data);
  });

  it("prepends /api prefix for relative paths", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      (url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        } as Response);
      },
    );

    await api.get("/servers");
    expect(capturedUrl).toBe("/api/servers");
  });

  it("throws ApiError on non-2xx response", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ detail: "Server not found" }),
      } as Response),
    );

    await expect(api.get("/servers/missing")).rejects.toThrow("Not Found");
  });

  it("includes auth header when credentials are set", async () => {
    let capturedInit: RequestInit = {};
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) => {
        capturedInit = init;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        } as Response);
      },
    );

    api.setAuth("admin", "secret123");
    await api.get("/servers");

    const headers = capturedInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Basic /);
  });

  it("encodes a non-ASCII password as UTF-8 instead of throwing", async () => {
    let capturedInit: RequestInit = {};
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      capturedInit = init;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) } as Response);
    });

    api.setAuth("admin", "пароль");
    await api.get("/servers/");

    const headers = capturedInit.headers as Record<string, string>;
    // base64 of the UTF-8 bytes, as `curl -u admin:пароль` sends it
    expect(headers["Authorization"]).toBe("Basic YWRtaW460L/QsNGA0L7Qu9GM");
    api.clearAuth();
  });

  it("errorMessage prefers the backend's detail", () => {
    expect(errorMessage(new ApiError(409, "Conflict", { detail: "Port 2302 overlaps 'A'" }), "x")).toBe(
      "Port 2302 overlaps 'A'",
    );
    expect(errorMessage(new ApiError(422, "", { detail: [{ msg: "bad" }] }), "fallback")).toBe("fallback");
    expect(errorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });

  // app/api/__init__.py omits `WWW-Authenticate: Basic` for requests carrying this
  // header, so a wrong password shows the login form's error instead of the
  // browser's native credentials dialog.
  it("marks JSON and upload requests with X-Requested-With", async () => {
    const seen: Record<string, string>[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) } as Response);
    });

    await api.get("/servers/");
    await api.upload("/missions/", new FormData());

    expect(seen).toHaveLength(2);
    for (const headers of seen) {
      expect(headers["X-Requested-With"]).toBe("XMLHttpRequest");
    }
  });

  it("makes POST request with JSON body", async () => {
    let capturedInit: RequestInit = {};
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) => {
        capturedInit = init;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: "1" }),
        } as Response);
      },
    );

    await api.post("/servers/", { hostname: "New Server" });
    expect(capturedInit.method).toBe("POST");
    expect(capturedInit.body).toBe(JSON.stringify({ hostname: "New Server" }));
  });

  it("makes PUT request with JSON body", async () => {
    let capturedInit: RequestInit = {};
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) => {
        capturedInit = init;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: "1" }),
        } as Response);
      },
    );

    await api.put("/servers/1", { hostname: "Updated" });
    expect(capturedInit.method).toBe("PUT");
    expect(capturedInit.body).toBe(JSON.stringify({ hostname: "Updated" }));
  });

  it("makes DELETE request", async () => {
    let capturedInit: RequestInit = {};
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) => {
        capturedInit = init;
        return Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve(null),
        } as Response);
      },
    );

    await api.del("/servers/1");
    expect(capturedInit.method).toBe("DELETE");
  });
});