import { createContext } from "react";

export interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  authRequired: boolean; // false when server has no auth configured
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
