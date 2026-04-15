import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DifficultyTab } from "@/features/servers/tabs/DifficultyTab";
import type { Server } from "@/types/api";

const MOCK_SERVER: Server = {
  id: "test-server",
  title: "Test Server",
  port: 2302,
  password: "",
  admin_password: "",
  auto_start: false,
  battle_eye: false,
  file_patching: false,
  forcedDifficulty: "Regular",
  max_players: 32,
  missions: [],
  mods: [],
  motd: null,
  number_of_headless_clients: 0,
  parameters: [],
  persistent: false,
  von: true,
  verify_signatures: 0,
  additionalConfigurationOptions: null,
  pid: null,
  state: { online: false },
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

vi.mock("@/hooks/useServers", () => ({
  useServer: () => ({ data: MOCK_SERVER, isLoading: false }),
  useUpdateServer: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/servers/test-server/difficulty"]}>
        <Routes>
          <Route path="/servers/:id/difficulty" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DifficultyTab", () => {
  it("renders difficulty preset selector", () => {
    render(<DifficultyTab />, { wrapper: Wrapper });
    expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
  });

  it("shows Custom flags section when Custom is selected", async () => {
    const user = userEvent.setup();
    render(<DifficultyTab />, { wrapper: Wrapper });

    await user.selectOptions(screen.getByLabelText("Forced Difficulty"), "Custom");

    expect(screen.getByText("Difficulty Flags")).toBeInTheDocument();
    expect(screen.getByText("AI Skill")).toBeInTheDocument();
  });

  it("hides Custom flags when a preset is selected", () => {
    render(<DifficultyTab />, { wrapper: Wrapper });
    expect(screen.queryByText("Difficulty Flags")).not.toBeInTheDocument();
  });

  it("toggles a difficulty flag", async () => {
    const user = userEvent.setup();
    render(<DifficultyTab />, { wrapper: Wrapper });

    await user.selectOptions(screen.getByLabelText("Forced Difficulty"), "Custom");

    const reducedDamageSwitch = screen.getByRole("switch", { name: /Reduced Damage/i });
    expect(reducedDamageSwitch).not.toBeChecked();

    await user.click(reducedDamageSwitch);
    expect(reducedDamageSwitch).toBeChecked();
  });

  it("renders all 4 difficulty presets", () => {
    render(<DifficultyTab />, { wrapper: Wrapper });
    const select = screen.getByLabelText("Forced Difficulty") as HTMLSelectElement;

    expect(select).toBeInTheDocument();
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain("Recruit");
    expect(options).toContain("Regular");
    expect(options).toContain("Veteran");
    expect(options).toContain("Custom");
  });

  it("renders AI skill inputs when Custom is selected", async () => {
    const user = userEvent.setup();
    render(<DifficultyTab />, { wrapper: Wrapper });

    await user.selectOptions(screen.getByLabelText("Forced Difficulty"), "Custom");

    expect(screen.getByLabelText("AI Skill (0–1)")).toBeInTheDocument();
    expect(screen.getByLabelText("AI Precision (0–1)")).toBeInTheDocument();
  });
});