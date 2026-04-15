import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/query-client";
import { routes } from "@/router";
import { getTheme, setTheme } from "@/lib/theme";
import { useServerStatus } from "@/hooks/useServerStatus";
import { AuthProvider, useAuth } from "@/features/auth/useAuth";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

// Apply theme on mount
setTheme(getTheme());

const router = createBrowserRouter(routes);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthGate />
          <Toaster position="bottom-right" />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { isAuthenticated, isChecking, authRequired } = useAuth();

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show login screen only when auth is required and user isn't authenticated
  if (authRequired && !isAuthenticated) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

/** Mounts the WS subscription so all screens get live updates. */
function AuthenticatedApp() {
  useServerStatus();
  return <RouterProvider router={router} />;
}

export default App;