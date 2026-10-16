import { useContext } from "react";
import { AuthContext, type AuthState } from "./auth-context";

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
