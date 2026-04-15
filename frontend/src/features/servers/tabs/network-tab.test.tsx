import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NetworkTab } from "@/features/servers/tabs/NetworkTab";
import type { Server } from "@/types/api";

const MOCK_SERVER: Server = {
  id: "test-server",
  title: "Test Server",
  port: 9520,
  password: "",
  admin_password: "",
  auto_start: false,
  battle_eye: false,
  file_patching: false,
  forcedDifficulty: null,
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
      <MemoryRouter initialEntries={["/servers/test-server/network"]}>
        <Routes>
          <Route path="/servers/:id/network" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("NetworkTab", () => {
  it("renders bandwidth preset buttons", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.getByText("Home 1Mbps")).toBeInTheDocument();
    expect(screen.getByText("VPS 10Mbps")).toBeInTheDocument();
    expect(screen.getByText("Dedicated 100Mbps")).toBeInTheDocument();
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  it("applies bandwidth preset on click", async () => {
    const user = userEvent.setup();
    render(<NetworkTab />, { wrapper: Wrapper });

    await user.click(screen.getByText("Unlimited"));

    // Unlimited sets MaxMsgSend to 4096
    const maxMsgSend = screen.getByLabelText("Max Messages Sent") as HTMLInputElement;
    expect(maxMsgSend.value).toBe("4096");
  });

  it("renders connection settings inputs", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.getByLabelText("Max Ping Kick (-1 = disabled)")).toBeInTheDocument();
    expect(screen.getByLabelText("Disconnect Timeout (s)")).toBeInTheDocument();
  });

  it("renders quality threshold inputs", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.getByLabelText("Max Packet Loss Kick % (-1 = disabled)")).toBeInTheDocument();
    expect(screen.getByLabelText("Max Desync Kick (-1 = disabled)")).toBeInTheDocument();
  });

  it("renders Save Changes button", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });
});