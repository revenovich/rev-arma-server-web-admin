import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerCard } from "@/components/servers/ServerCard";
import { useServers } from "@/hooks/useServers";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewScreen() {
  const { data: servers, isLoading, error } = useServers();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-danger">Failed to load servers</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const hasServers = servers && servers.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight gradient-heading">
          Servers
        </h1>
        <Button size="sm">Add Server</Button>
      </div>

      {hasServers ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <Server className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No servers yet</p>
            <p className="text-xs text-muted-foreground">
              Add your first Arma server to get started.
            </p>
          </div>
          <Button size="sm">Add Server</Button>
        </div>
      )}
    </div>
  );
}