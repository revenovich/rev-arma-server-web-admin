import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/query-client";
import { routes } from "@/router";
import { getTheme, setTheme } from "@/lib/theme";
import { useServerStatus } from "@/hooks/useServerStatus";

// Apply theme on mount
setTheme(getTheme());

const router = createBrowserRouter(routes);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ServerStatusProvider />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

/** Mounts the WS subscription so all screens get live updates. */
function ServerStatusProvider() {
  useServerStatus();
  return <RouterProvider router={router} />;
}

export default App;