import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./useAuth";
import { api, ApiError } from "@/lib/api";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown) {
      super(statusText);
      this.name = "ApiError";
      this.status = status;
      this.statusText = statusText;
      this.body = body;
    }
  },
}));

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
vi.stubGlobal("sessionStorage", sessionStorageMock);

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="checking">{String(auth.isChecking)}</div>
      <div data-testid="auth-required">{String(auth.authRequired)}</div>
      <button data-testid="login-btn" onClick={() => { auth.login("admin", "pass").catch(() => {}) }}>Login</button>
      <button data-testid="logout-btn" onClick={auth.logout}>Logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
  });

  it("sets isAuthenticated=true when auth is not required", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ auth_required: false });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });
    expect(screen.getByTestId("auth-required").textContent).toBe("false");
    expect(screen.getByTestId("checking").textContent).toBe("false");
  });

  it("sets isAuthenticated=false when auth is required but no stored creds", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ auth_required: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });
    expect(screen.getByTestId("auth-required").textContent).toBe("true");
  });

  it("validates stored credentials on mount", async () => {
    sessionStorageMock.setItem("arma_auth", JSON.stringify({ username: "admin", password: "pass" }));
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ auth_required: true })
      .mockResolvedValueOnce({}); // servers list — validates creds

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });
  });

  it("clears auth on invalid stored credentials", async () => {
    sessionStorageMock.setItem("arma_auth", JSON.stringify({ username: "admin", password: "wrong" }));
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ auth_required: true })
      .mockRejectedValueOnce(new ApiError(401, "Unauthorized", null));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });
    expect(api.clearAuth).toHaveBeenCalled();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("arma_auth");
  });

  it("sets isChecking=false after auth probe completes", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ auth_required: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Initially checking
    // After probe completes, checking should be false
    await waitFor(() => {
      expect(screen.getByTestId("checking").textContent).toBe("false");
    });
  });

  it("logout clears auth and sessionStorage", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ auth_required: false });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });

    await act(async () => {
      screen.getByTestId("logout-btn").click();
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(api.clearAuth).toHaveBeenCalled();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("arma_auth");
  });

  it("sets authRequired=true on server error during probe", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-required").textContent).toBe("true");
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });
});

describe("useAuth (outside provider)", () => {
  it("returns safe defaults when used outside AuthProvider", () => {
    let result: ReturnType<typeof useAuth> | undefined;
    function TestComponent() {
      result = useAuth();
      return null;
    }
    render(<TestComponent />);
    expect(result!.isAuthenticated).toBe(true);
    expect(result!.isChecking).toBe(false);
    expect(result!.authRequired).toBe(false);
  });
});