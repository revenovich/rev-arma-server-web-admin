import { Link } from "react-router-dom";
import { Play, Square, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/servers/StatusDot";
import type { Server } from "@/types/api";

interface ServerCardProps {
  server: Server;
}

export function ServerCard({ server }: ServerCardProps) {
  const online = server.state?.online ?? false;
  const players = server.state?.players ?? 0;
  const maxPlayers = server.state?.maxPlayers ?? server.max_players;

  return (
    <Link to={`/servers/${server.id}/info`}>
      <Card className="group flex flex-col gap-3 p-5 transition-all duration-200 hover:bg-white/10 hover:scale-[1.01]">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-medium leading-snug text-foreground group-hover:text-indigo-300 transition-colors">
            {server.title}
          </h3>
          <StatusDot online={online} />
        </div>

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

        <div className="mt-auto flex items-center gap-2 pt-1">
          {online ? (
            <span className="flex items-center gap-1 text-xs text-success">
              <Square className="h-3 w-3" />
              Running
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Play className="h-3 w-3" />
              Stopped
            </span>
          )}
          {server.persistent && (
            <Badge variant="outline" className="text-xs">
              Persistent
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}