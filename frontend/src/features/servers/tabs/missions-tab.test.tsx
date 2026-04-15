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

const MOCK_SERVER_WITH_MISSIONS: Server = {
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
  missions: [
    { template: "co_10_escape.malden.pbo", difficulty: "Regular" },
    { template: "tvt_20_battle.altis.pbo", difficulty: "Veteran" },
  ],
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
    // Available missions section shows worldName
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
    // First mission has difficulty "Regular"
    expect(selects[0].value).toBe("Regular");
    // Second mission has difficulty "Veteran"
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
});
