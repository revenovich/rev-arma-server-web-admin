import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NetworkTab } from "@/features/servers/tabs/NetworkTab";
import type { Server } from "@/types/api";

const MOCK_SERVER_WITH_NETWORK: Server = {
  id: "test-server",
  title: "Test Server",
  port: 2302,
  password: "",
  admin_password: "",
  auto_start: false,
  battle_eye: false,
  file_patching: false,
  forcedDifficulty: null,
  allowed_file_patching: 0,
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
  state: { online: false, players: 0, maxPlayers: 0, mission: null, map: null },
  // Network fields (passed through extra="allow")
  MaxMsgSend: 256,
  MaxSizeGuaranteed: 1024,
  MaxSizeNonguaranteed: 512,
  MinBandwidth: 262144,
  MaxBandwidth: 2097152,
  MinPacketSize: 44,
  MaxPacketSize: 1400,
  MaxPing: 200,
  MaxPacketLoss: 10,
  MaxDesync: 500,
  DisconnectTimeout: 30,
  kickDuplicate: 1,
  loopback: 1,
  upnp: 0,
} as Server & Record<string, unknown>;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

vi.mock("@/hooks/useServers", () => ({
  useServer: () => ({ data: MOCK_SERVER_WITH_NETWORK, isLoading: false }),
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

  // ── NEW: Form initialization from server data ────────────────────────────

  it("populates form fields from server data", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    const maxMsgSend = screen.getByLabelText("Max Messages Sent") as HTMLInputElement;
    expect(maxMsgSend.value).toBe("256");
    const maxPing = screen.getByLabelText("Max Ping Kick (-1 = disabled)") as HTMLInputElement;
    expect(maxPing.value).toBe("200");
    const disconnect = screen.getByLabelText("Disconnect Timeout (s)") as HTMLInputElement;
    expect(disconnect.value).toBe("30");
  });

  // ── NEW: loopback and upnp as switches ────────────────────────────────

  it("renders Loopback as a switch (not number input)", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.getByRole("switch", { name: /loopback/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/loopback.*number/i)).not.toBeInTheDocument();
  });

  it("renders UPnP as a switch (not number input)", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.getByRole("switch", { name: /upnp/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/upnp.*number/i)).not.toBeInTheDocument();
  });

  // ── NEW: kickDuplicate removed from NetworkTab ──────────────────────────

  it("does NOT render kickDuplicate (moved to Security tab)", () => {
    render(<NetworkTab />, { wrapper: Wrapper });
    expect(screen.queryByLabelText(/kick duplicate/i)).not.toBeInTheDocument();
  });
});