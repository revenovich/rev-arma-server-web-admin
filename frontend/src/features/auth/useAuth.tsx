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

  // On mount, check if auth is required and if we have stored credentials
  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);

    if (stored) {
      try {
        const { username, password } = JSON.parse(stored);
        api.setAuth(username, password);
      } catch {
        sessionStorage.removeItem(AUTH_KEY);
      }
    }

    // Probe the server — if we get 200, auth is either disabled or credentials work
    // If we get 401, auth is required and credentials are missing/invalid
    api.get("/servers").then(
      () => {
        // Either no auth required, or stored credentials are valid
        setIsAuthenticated(true);
        setAuthRequired(stored !== null); // auth required only if we used stored creds
        setIsChecking(false);
      },
      (err) => {
        if (err instanceof ApiError && err.status === 401) {
          // Auth is required but no valid credentials
          api.clearAuth();
          sessionStorage.removeItem(AUTH_KEY);
          setIsAuthenticated(false);
          setAuthRequired(true);
          setIsChecking(false);
        } else {
          // Server unreachable — treat as no auth for now (will retry on API calls)
          setIsAuthenticated(true);
          setAuthRequired(false);
          setIsChecking(false);
        }
      },
    );
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    api.setAuth(username, password);
    try {
      await api.get("/servers");
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({ username, password }));
      setIsAuthenticated(true);
      setAuthRequired(true);
    } catch (err) {
      api.clearAuth();
      if (err instanceof ApiError && err.status === 401) {
        throw new Error("Invalid username or password");
      }
      if (err instanceof ApiError && err.status === 429) {
        throw new Error("Too many failed attempts — try again later");
      }
      throw new Error("Connection failed — is the server running?");
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