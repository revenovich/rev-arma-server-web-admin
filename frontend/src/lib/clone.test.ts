import { describe, it, expect } from "vitest";
import { clonePayload } from "@/lib/clone";
import type { Server } from "@/types/api";

const server = {
  id: "alpha",
  title: "Alpha",
  port: 2302,
  pid: 42,
  state: { online: true, players: 1, maxPlayers: 10, mission: null, map: null },
  max_players: 10,
} as unknown as Server;

describe("clonePayload", () => {
  it("drops runtime fields and the port, so the backend picks a free port", () => {
    const payload = clonePayload(server);
    expect(payload).toEqual({ title: "Copy of Alpha", max_players: 10 });
  });

  it("numbers the title when a copy already exists", () => {
    const existing = [server, { ...server, title: "Copy of Alpha" }, { ...server, title: "copy of alpha (2)" }];
    expect(clonePayload(server, existing).title).toBe("Copy of Alpha (3)");
  });
});
