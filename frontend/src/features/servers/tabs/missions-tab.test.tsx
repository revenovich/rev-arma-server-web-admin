import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MissionsTab } from "./MissionsTab";
import type { Mission, Server } from "@/types/api";

const mockUpdate = vi.fn();
const mockInvalidate = vi.fn();

const MOCK_MISSIONS: Mission[] = [
  {
    name: "co_10_escape.malden.pbo",
    missionName: "co_10_escape",
    worldName: "malden",
    size: 12345,
    sizeFormatted: "12.1 KB",
    dateCreated: "2024-01-01",
    dateModified: "2024-01-02",
  },
  {
    name: "tvt_20_battle.altis.pbo",
    missionName: "tvt_20_battle",
    worldName: "altis",
    size: 99999,
    sizeFormatted: "97.7 KB",
    dateCreated: "2024-02-01",
    dateModified: "2024-02-02",
  },
];

function createMockServer(missions: unknown[]): Server {
  return {
    id: "srv-1",
    title: "Test Server",
    port: 2302,
    password: null,
    admin_password: null,
    auto_start: false,
    battle_eye: true,
    file_patching: false,
    forcedDifficulty: null,
    allowed_file_patching: 0,
    max_players: 32,
    missions,
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
}

const MOCK_SERVER_WITH_MISSIONS = createMockServer([
  { template: "co_10_escape.malden.pbo", difficulty: "Regular", params: [] },
  { template: "tvt_20_battle.altis.pbo", difficulty: "Veteran", params: ["missionConfig = 1"] },
]);

vi.mock("@/hooks/useServers", () => ({
  useServer: vi.fn(() => ({ data: MOCK_SERVER_WITH_MISSIONS, isLoading: false })),
  useUpdateServer: vi.fn(() => ({ mutateAsync: mockUpdate, isPending: false })),
}));

vi.mock("@/hooks/useMissions", () => ({
  useMissions: vi.fn(() => ({ data: MOCK_MISSIONS, isLoading: false })),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidate })),
  };
});

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/servers/srv-1/missions"]}>
        <Routes>
          <Route path="/servers/:id/missions" element={<MissionsTab />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MissionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows missions in rotation", () => {
    renderTab();
    expect(screen.getByText("co_10_escape.malden.pbo")).toBeInTheDocument();
    expect(screen.getByText("tvt_20_battle.altis.pbo")).toBeInTheDocument();
  });

  it("shows worldName for available missions", () => {
    renderTab();
    expect(screen.getByText(/malden/i)).toBeInTheDocument();
    expect(screen.getByText(/altis/i)).toBeInTheDocument();
  });

  it("renders a difficulty dropdown for each mission in the rotation", () => {
    renderTab();
    const difficultySelects = screen.getAllByRole("combobox");
    expect(difficultySelects.length).toBeGreaterThanOrEqual(2);
  });

  it("preloads difficulty from server mission data", () => {
    renderTab();
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0].value).toBe("Regular");
    expect(selects[1].value).toBe("Veteran");
  });

  it("Refresh button invalidates missions query", () => {
    renderTab();
    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(refreshBtn);
    expect(mockInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["missions"] }),
    );
  });

  // ── NEW: Per-mission parameters ──────────────────────────────────────────

  it("shows existing mission params as chips", () => {
    renderTab();
    // Second mission has params: ["missionConfig = 1"]
    expect(screen.getAllByText("missionConfig = 1").length).toBeGreaterThan(0);
  });

  it("can add a parameter to a mission", () => {
    renderTab();
    // Find param input for the first mission and add a param
    const paramInputs = screen.getAllByPlaceholderText(/param/i);
    fireEvent.change(paramInputs[0], { target: { value: "viewDistance = 3000" } });
    fireEvent.keyDown(paramInputs[0], { key: "Enter" });
    expect(screen.getAllByText("viewDistance = 3000").length).toBeGreaterThan(0);
  });

  it("can remove a parameter from a mission", () => {
    renderTab();
    // Second mission has "missionConfig = 1" param — find its remove button
    const removeBtn = screen.getByRole("button", { name: /remove param missionConfig = 1/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText("missionConfig = 1")).not.toBeInTheDocument();
  });

  it("includes params in save payload", async () => {
    renderTab();
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          missions: expect.arrayContaining([
            expect.objectContaining({ params: expect.any(Array) }),
          ]),
        }),
      );
    });
  });
});