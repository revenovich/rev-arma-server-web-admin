import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ModsTab } from "./ModsTab";
import type { Mod, Server } from "@/types/api";

const mockUpdate = vi.fn();
const mockInvalidate = vi.fn();

const MOCK_MODS: Mod[] = [
  { name: "@CBA_A3", size: 5000000, formattedSize: "4.8 MB", modFile: null, steamMeta: null },
  { name: "@ace", size: 75000000, formattedSize: "71.5 MB", modFile: null, steamMeta: null },
  { name: "@TFAR", size: 10000000, formattedSize: "9.5 MB", modFile: null, steamMeta: null },
];

const MOCK_SERVER: Server = {
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
  missions: [],
  mods: ["@CBA_A3"],
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
  useServer: vi.fn(() => ({ data: MOCK_SERVER, isLoading: false })),
  useUpdateServer: vi.fn(() => ({ mutateAsync: mockUpdate, isPending: false })),
}));

vi.mock("@/hooks/useMods", () => ({
  useMods: vi.fn(() => ({ data: MOCK_MODS, isLoading: false })),
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
      <MemoryRouter initialEntries={["/servers/srv-1/mods"]}>
        <Routes>
          <Route path="/servers/:id/mods" element={<ModsTab />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ModsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows available mods from the API (not in active list)", () => {
    renderTab();
    // @ace and @TFAR are not in server.mods, so should appear in available
    expect(screen.getByText("@ace")).toBeInTheDocument();
    expect(screen.getByText("@TFAR")).toBeInTheDocument();
  });

  it("shows active mods from server data", () => {
    renderTab();
    // @CBA_A3 is in server.mods
    expect(screen.getByText("@CBA_A3")).toBeInTheDocument();
  });

  it("available mod shows its formatted size", () => {
    renderTab();
    expect(screen.getByText("71.5 MB")).toBeInTheDocument();
  });

  it("Refresh button invalidates mods query", () => {
    renderTab();
    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(refreshBtn);
    expect(mockInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["mods"] }),
    );
  });
});
