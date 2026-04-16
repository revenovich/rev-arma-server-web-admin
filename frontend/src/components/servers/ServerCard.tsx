import { Link } from "react-router-dom";
import { Play, Square, Users, Copy, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/servers/StatusDot";
import { useStartServer, useStopServer, useCreateServer } from "@/hooks/useServers";
import type { Server } from "@/types/api";

interface ServerCardProps {
  server: Server;
}

export function ServerCard({ server }: ServerCardProps) {
  const online = server.state?.online ?? false;
  const players = server.state?.players ?? 0;
  const maxPlayers = server.state?.maxPlayers ?? server.max_players;

  const { mutate: startServer, isPending: isStarting } = useStartServer(server.id);
  const { mutate: stopServer, isPending: isStopping } = useStopServer(server.id);
  const { mutate: createServer, isPending: isCloning } = useCreateServer();

  function handleStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startServer();
  }

  function handleStop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    stopServer();
  }

  function handleClone(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, pid, state, ...rest } = server;
    createServer({ ...rest, title: `Copy of ${server.title}` });
  }

  return (
    <Card className="group flex flex-col gap-3 p-5 transition-all duration-200 hover:bg-white/10 hover:scale-[1.01]">
      {/* Title row — the link area */}
      <Link
        to={`/servers/${server.id}/general`}
        className="flex items-start justify-between"
        aria-label={`Open ${server.title}`}
      >
        <h3 className="text-base font-medium leading-snug text-foreground group-hover:text-indigo-300 transition-colors">
          {server.title}
        </h3>
        <StatusDot online={online} />
      </Link>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Users className="h-3.5 w-3.5" />
          {players}/{maxPlayers}
        </span>
        <Badge variant="secondary" className="font-mono text-xs">
          :{server.port}
        </Badge>
      </div>

      {server.state?.mission && (
        <p className="truncate text-xs text-muted-foreground">
          {server.state.mission}
        </p>
      )}

      {/* Action row */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {server.persistent && (
            <Badge variant="outline" className="text-xs">
              Persistent
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Clone */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Clone server"
            disabled={isCloning}
            onClick={handleClone}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            {isCloning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Start / Stop */}
          {online ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Stop server"
              disabled={isStopping}
              onClick={handleStop}
              className="h-7 gap-1 px-2 text-xs text-danger hover:bg-danger/10 hover:text-danger"
            >
              {isStopping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Stop
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Start server"
              disabled={isStarting}
              onClick={handleStart}
              className="h-7 gap-1 px-2 text-xs text-success hover:bg-success/10 hover:text-success"
            >
              {isStarting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Start
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
