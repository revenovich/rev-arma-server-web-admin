import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";

interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  authRequired: boolean; // false when server has no auth configured
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_KEY = "arma_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);

    async function checkAuth() {
      try {
        // 1. Check if auth is required — this endpoint needs no credentials
        const { auth_required } = await api.get<{ auth_required: boolean }>("/auth");

        if (!auth_required) {
          // Auth is disabled on the server — go straight in
          setIsAuthenticated(true);
          setAuthRequired(false);
          setIsChecking(false);
          return;
        }

        // 2. Auth is required
        setAuthRequired(true);

        if (!stored) {
          // No stored credentials — show login screen
          setIsAuthenticated(false);
          setIsChecking(false);
          return;
        }

        // 3. Try to validate stored credentials
        try {
          const { username, password } = JSON.parse(stored);
          api.setAuth(username, password);
          // Use trailing slash to avoid 307 redirect which may strip Authorization header
          await api.get("/servers/");
          setIsAuthenticated(true);
        } catch {
          // Stored credentials are invalid or expired
          api.clearAuth();
          sessionStorage.removeItem(AUTH_KEY);
          setIsAuthenticated(false);
        }
      } catch {
        // Cannot reach server at all — show login screen
        // (the login form will report a connection error when the user tries)
        setIsAuthenticated(false);
        setAuthRequired(true);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      api.setAuth(username, password);
      // Use trailing slash to hit the route directly — avoids the 307 redirect
      // from /api/servers → /api/servers/ which may strip the Authorization header
      await api.get("/servers/");
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({ username, password }));
      setIsAuthenticated(true);
      setAuthRequired(true);
    } catch (err) {
      api.clearAuth();
      if (err instanceof ApiError) {
        if (err.status === 401) throw new Error("Invalid username or password");
        if (err.status === 429) throw new Error("Too many failed attempts — try again later");
        throw new Error(`Server returned ${err.status} — check server logs`);
      }
      throw new Error("Cannot reach server — is it running on the correct port?");
    }
  }, []);

  const logout = useCallback(() => {
    api.clearAuth();
    sessionStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isChecking, authRequired, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  // Return a safe default when used outside AuthProvider (e.g. in tests)
  if (!ctx) {
    return {
      isAuthenticated: true,
      isChecking: false,
      authRequired: false,
      login: async () => {},
      logout: () => {},
    };
  }
  return ctx;
}
