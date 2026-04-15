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

  it("calls createServer with title and default port on submit", async () => {
    renderDialog();
    fireEvent.click(getTrigger());
    await waitFor(() => screen.getByLabelText(/server name/i));

    fireEvent.change(screen.getByLabelText(/server name/i), {
      target: { value: "Alpha Server" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Alpha Server", port: 2302 }),
      expect.anything(),
    );
  });
});
