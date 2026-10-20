import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddServerDialog } from "@/components/servers/AddServerDialog";

const mockCreate = vi.fn();

vi.mock("@/hooks/useServers", () => ({
  useCreateServer: vi.fn(() => ({
    mutate: mockCreate,
    isPending: false,
  })),
}));

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddServerDialog />
    </QueryClientProvider>,
  );
}

// Base UI Dialog renders an accessibility clone of the trigger — use [0] to get the visible one.
function getTrigger() {
  return screen.getAllByRole("button", { name: /add server/i })[0];
}

describe("AddServerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an Add Server trigger button", () => {
    renderDialog();
    expect(getTrigger()).toBeInTheDocument();
  });

  it("opens the dialog when the trigger is clicked", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("renders server name input in the dialog", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => {
      expect(screen.getByLabelText(/server name/i)).toBeInTheDocument();
    });
  });

  it("renders port input in the dialog", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => {
      expect(screen.getByLabelText(/port/i)).toBeInTheDocument();
    });
  });

  it("Create button is disabled when title is empty", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
    });
  });

  it("Create button is enabled when title is filled", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));
    fireEvent.change(screen.getByLabelText(/server name/i), {
      target: { value: "My Test Server" },
    });
    expect(screen.getByRole("button", { name: /create/i })).not.toBeDisabled();
  });

  it("leaves the port out when it is empty, so the backend picks a free one", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));

    fireEvent.change(screen.getByLabelText(/server name/i), {
      target: { value: "Alpha Server" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(mockCreate).toHaveBeenCalledWith({ title: "Alpha Server", password: null }, expect.anything());
  });

  it("sends a typed port and refuses an out-of-range one", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));
    fireEvent.change(screen.getByLabelText(/server name/i), { target: { value: "Alpha" } });

    fireEvent.change(screen.getByLabelText(/^port$/i), { target: { value: "65535" } });
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^port$/i), { target: { value: "2402" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Alpha", port: 2402 }),
      expect.anything(),
    );
  });

  it("sends one request when Create is clicked twice quickly", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));
    fireEvent.change(screen.getByLabelText(/server name/i), { target: { value: "Alpha" } });

    const create = screen.getByRole("button", { name: /create/i });
    fireEvent.click(create);
    fireEvent.click(create);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("starts empty again after Cancel", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));
    fireEvent.change(screen.getByLabelText(/server name/i), { target: { value: "Stale" } });
    fireEvent.change(screen.getByLabelText(/^port$/i), { target: { value: "2402" } });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));

    expect(screen.getByLabelText(/server name/i)).toHaveValue("");
    expect(screen.getByLabelText(/^port$/i)).toHaveValue(null);
  });
});
