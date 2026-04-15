import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight gradient-heading">
            Arma Server Admin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm text-muted-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="glass-input h-9 w-full px-3 text-sm"
              placeholder="admin"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input h-9 w-full px-3 text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p
              className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary h-9 w-full justify-center"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}