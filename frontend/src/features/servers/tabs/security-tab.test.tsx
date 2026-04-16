import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SecurityTab } from "./SecurityTab";
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
  file_patching: true,
  forcedDifficulty: null,
  allowed_file_patching: 1,
  max_players: 32,
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
} as Server & Record<string, unknown>;

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
      <MemoryRouter initialEntries={["/servers/srv-1/security"]}>
        <Routes>
          <Route path="/servers/:id/security" element={<SecurityTab />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SecurityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders verify_signatures as a dropdown", () => {
    renderTab();
    const select = screen.getByLabelText(/verify signatures/i);
    expect(select.tagName).toBe("SELECT");
  });

  it("verify_signatures dropdown has Off / v1+v2 / v2 Only options", () => {
    renderTab();
    const select = screen.getByLabelText(/verify signatures/i) as HTMLSelectElement;
    expect(select.options.length).toBe(3);
  });

  it("renders allowed_file_patching as a dropdown", () => {
    renderTab();
    const select = screen.getByLabelText(/allowed file patching/i);
    expect(select.tagName).toBe("SELECT");
  });

  it("renders BattlEye switch", () => {
    renderTab();
    expect(screen.getByRole("switch", { name: /battl/i })).toBeInTheDocument();
  });

  // ── NEW: file_patching switch (moved from InfoTab) ─────────────────────

  it("renders File Patching switch (CLI flag)", () => {
    renderTab();
    expect(screen.getByRole("switch", { name: /file patching/i })).toBeInTheDocument();
  });

  // ── NEW: kickDuplicate as switch ───────────────────────────────────────

  it("renders Kick Duplicate as a switch (not number input)", () => {
    renderTab();
    expect(screen.getByRole("switch", { name: /kick duplicate/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/kick duplicate.*number/i)).not.toBeInTheDocument();
  });

  it("renders Server Command Password input", () => {
    renderTab();
    expect(screen.getByLabelText(/password for server commands/i)).toBeInTheDocument();
  });

  // ── NEW: filePatchingExceptions and allowedLoadFileExtensions ───────────

  it("renders file patching exceptions input", () => {
    renderTab();
    expect(screen.getByLabelText(/file patching exceptions/i)).toBeInTheDocument();
  });

  it("renders allowed load file extensions input", () => {
    renderTab();
    expect(screen.getByLabelText(/allowed load file extensions/i)).toBeInTheDocument();
  });

  // ── NEW: Save includes all fields ──────────────────────────────────────

  it("saves verify_signatures, allowed_file_patching, battle_eye, file_patching, and kickDuplicate", async () => {
    renderTab();
    const saveBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveBtn);
    await vi.waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          verify_signatures: expect.any(Number),
          allowed_file_patching: expect.any(Number),
          battle_eye: expect.any(Boolean),
          file_patching: expect.any(Boolean),
          kickDuplicate: expect.any(Number),
        }),
      );
    });
  });
});