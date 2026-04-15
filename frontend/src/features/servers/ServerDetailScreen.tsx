import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Play, Square, Copy, Trash2, Loader2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusDot } from "@/components/servers/StatusDot";
import {
  useServer,
  useStartServer,
  useStopServer,
  useCreateServer,
  useDeleteServer,
} from "@/hooks/useServers";
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

  const { mutate: startServer, isPending: isStarting } = useStartServer(id ?? "");
  const { mutate: stopServer, isPending: isStopping } = useStopServer(id ?? "");
  const { mutate: createServer, isPending: isCloning } = useCreateServer();
  const { mutate: deleteServer, isPending: isDeleting } = useDeleteServer();

  const pathSegments = location.pathname.split("/");
  const currentTab = (pathSegments[3] as ServerTab) ?? "info";

  const online = server?.state?.online ?? false;
  const players = server?.state?.players ?? 0;
  const maxPlayers = server?.state?.maxPlayers ?? server?.max_players ?? 0;

  function handleTabChange(value: string) {
    navigate(`/servers/${id}/${value}`);
  }

  function handleClone() {
    if (!server) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, pid: _pid, state: _state, ...rest } = server;
    createServer({ ...rest, title: `Copy of ${server.title}` });
  }

  function handleDelete() {
    if (!id) return;
    deleteServer(id, {
      onSuccess: () => navigate("/"),
    });
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
          className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label="Back to servers"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Title + status */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <h1 className="truncate text-2xl font-bold tracking-tight gradient-heading">
                {server?.title ?? "Server"}
              </h1>
              {server && (
                <StatusDot online={online} />
              )}
              {online && (
                <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                  <Users className="mr-1 h-3 w-3" />
                  {players}/{maxPlayers}
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        {!isLoading && server && (
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Start / Stop */}
            {online ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Stop server"
                disabled={isStopping}
                onClick={() => stopServer()}
                className="gap-1.5 text-danger hover:bg-danger/10 hover:text-danger"
              >
                {isStopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Stop
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Start server"
                disabled={isStarting}
                onClick={() => startServer()}
                className="gap-1.5 text-success hover:bg-success/10 hover:text-success"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start
              </Button>
            )}

            {/* Clone */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Clone server"
              disabled={isCloning}
              onClick={handleClone}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              {isCloning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Clone
            </Button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete server"
                    className="gap-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  />
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete server?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove <strong>{server.title}</strong> and its configuration. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={handleDelete}
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
                "rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200",
                "data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-100 data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-indigo-400/30",
                "hover:bg-white/5",
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
