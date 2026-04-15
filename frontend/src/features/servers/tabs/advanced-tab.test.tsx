import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdvancedTab } from "./AdvancedTab";
import type { Server } from "@/types/api";

const mockUpdate = vi.fn();

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
  mods: [],
  motd: null,
  number_of_headless_clients: 0,
  parameters: ["-world Altis", "-serverMod @GM"],
  persistent: false,
  von: true,
  verify_signatures: 2,
  additionalConfigurationOptions: "someOption = 1;",
  pid: null,
  state: null,
};

vi.mock("@/hooks/useServers", () => ({
  useServer: vi.fn(() => ({ data: MOCK_SERVER, isLoading: false })),
  useUpdateServer: vi.fn(() => ({ mutateAsync: mockUpdate, isPending: false })),
}));

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/servers/srv-1/advanced"]}>
        <Routes>
          <Route path="/servers/:id/advanced" element={<AdvancedTab />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdvancedTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the parameters section", () => {
    renderTab();
    expect(screen.getByText(/launch parameters/i)).toBeInTheDocument();
  });

  it("shows existing parameters as chips", () => {
    renderTab();
    // getAllByText handles multiple DOM nodes containing the same text
    expect(screen.getAllByText("-world Altis").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-serverMod @GM").length).toBeGreaterThan(0);
  });

  it("can add a new parameter via input", () => {
    renderTab();
    const input = screen.getByPlaceholderText(/-mod/i);
    fireEvent.change(input, { target: { value: "-config myconfig.cfg" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getAllByText("-config myconfig.cfg").length).toBeGreaterThan(0);
  });

  it("can remove a parameter chip", () => {
    renderTab();
    const removeButtons = screen.getAllByRole("button", { name: /remove -world Altis/i });
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText("-world Altis")).not.toBeInTheDocument();
  });

  it("does not render a Persistent toggle (moved to InfoTab)", () => {
    renderTab();
    // The AdvancedTab should not have a switch or label for Persistent
    expect(screen.queryByRole("switch", { name: /persistent/i })).not.toBeInTheDocument();
  });

  it("renders the additional configuration textarea", () => {
    renderTab();
    expect(screen.getByRole("textbox", { name: /additional/i })).toBeInTheDocument();
  });
});
