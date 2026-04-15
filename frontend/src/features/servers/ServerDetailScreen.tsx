import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServer } from "@/hooks/useServers";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TAB_ITEMS = [
  { value: "info", label: "Info" },
  { value: "missions", label: "Missions" },
  { value: "mods", label: "Mods" },
  { value: "difficulty", label: "Difficulty" },
  { value: "network", label: "Network" },
  { value: "security", label: "Security" },
  { value: "advanced", label: "Advanced" },
  { value: "headless", label: "Headless" },
] as const;

export type ServerTab = (typeof TAB_ITEMS)[number]["value"];

export function ServerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: server, isLoading, error } = useServer(id ?? "");

  const pathSegments = location.pathname.split("/");
  const currentTab = (pathSegments[3] as ServerTab) ?? "info";

  function handleTabChange(value: string) {
    navigate(`/servers/${id}/${value}`);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-danger" />
        <p className="text-danger">Failed to load server</p>
        <Link to="/" className="mt-4 text-sm text-accent hover:underline">
          Back to servers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          aria-label="Back to servers"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">
            {server?.title ?? "Server"}
          </h1>
        )}
      </div>

      {/* Tab strip — URL-synced */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-transparent p-0">
          {TAB_ITEMS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors",
                "data-[state=active]:bg-surface-raised data-[state=active]:text-foreground",
                "hover:bg-surface-raised/50",
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Tab content — rendered by child routes */}
      <Outlet />
    </div>
  );
}