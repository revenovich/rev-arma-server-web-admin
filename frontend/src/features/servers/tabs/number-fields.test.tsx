// P30: number fields must accept negative numbers and refuse invalid input on save.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { toast } from "sonner";
import { NetworkTab } from "@/features/servers/tabs/NetworkTab";
import { AdvancedTab } from "@/features/servers/tabs/AdvancedTab";
import type { Server } from "@/types/api";

const mutateAsync = vi.fn();

const SERVER = {
  id: "s",
  title: "S",
  port: 2302,
  parameters: [],
  motd: null,
  additionalConfigurationOptions: null,
  number_of_headless_clients: 1,
  MaxPing: 200,
} as unknown as Server;

vi.mock("@/hooks/useServers", () => ({
  useServer: () => ({ data: SERVER, isLoading: false }),
  useUpdateServer: () => ({ mutateAsync, isPending: false }),
}));

function renderTab(tab: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/servers/s/x"]}>
      <Routes>
        <Route path="/servers/:id/x" element={tab} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mutateAsync.mockReset();
});

describe("NetworkTab number fields", () => {
  it("lets -1 be typed and saves it as -1", async () => {
    const user = userEvent.setup();
    renderTab(<NetworkTab />);
    const maxPing = screen.getByLabelText("Max Ping Kick (-1 = disabled)");

    await user.clear(maxPing);
    await user.type(maxPing, "-1");
    expect(maxPing).toHaveValue(-1);

    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ MaxPing: -1, MaxMsgSend: 128 }));
  });

  it("refuses to save an empty field instead of sending 0", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(toast, "error");
    renderTab(<NetworkTab />);

    await user.clear(screen.getByLabelText("Max Bandwidth (Bps)"));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("MaxBandwidth must be a whole number");
    errorSpy.mockRestore();
  });
});

describe("AdvancedTab headless clients", () => {
  it("refuses a negative count instead of saving its absolute value", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(toast, "error");
    renderTab(<AdvancedTab />);
    const hc = screen.getByLabelText("Number of Headless Clients");

    await user.clear(hc);
    await user.type(hc, "-3");
    expect(hc).toHaveValue(-3);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("Number of headless clients must be a whole number, 0 or more");
    errorSpy.mockRestore();
  });

  it("saves a valid count as a number", async () => {
    const user = userEvent.setup();
    renderTab(<AdvancedTab />);
    const hc = screen.getByLabelText("Number of Headless Clients");

    await user.clear(hc);
    await user.type(hc, "2");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ number_of_headless_clients: 2 }));
  });
});
