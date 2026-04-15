import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribe } from "@/lib/ws";
import type { Server, ServerState } from "@/types/api";

const SERVERS_KEY = ["servers"] as const;

/**
 * Subscribes to the WebSocket event bus and patches the TanStack Query cache
 * in-place for real-time server status updates without a full refetch.
 */
export function useServerStatus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      switch (event.type) {
        case "servers": {
          // Full server list update — replace cache
          const servers = event.payload as Server[];
          queryClient.setQueryData(SERVERS_KEY, servers);
          break;
        }
        case "server": {
          // Single server update — patch in the list
          const updated = event.payload as Server;
          queryClient.setQueryData<Server[]>(SERVERS_KEY, (old) => {
            if (!old) return old;
            return old.map((s) => (s.id === updated.id ? updated : s));
          });
          // Also patch the individual server query
          queryClient.setQueryData([...SERVERS_KEY, updated.id], updated);
          break;
        }
        case "server_state": {
          // Server state update (pid, online status, player count)
          const serverId = event.serverId;
          const state = event.payload as ServerState;
          if (!serverId) break;

          queryClient.setQueryData<Server[]>(SERVERS_KEY, (old) => {
            if (!old) return old;
            return old.map((s) =>
              s.id === serverId ? { ...s, state, pid: state?.online ? s.pid : null } : s,
            );
          });

          queryClient.setQueryData<Server>([...SERVERS_KEY, serverId], (old) => {
            if (!old) return old;
            return { ...old, state, pid: state?.online ? old.pid : null };
          });
          break;
        }
        case "mods": {
          // Invalidate mods query so they refetch on next access
          void queryClient.invalidateQueries({ queryKey: ["mods"] });
          break;
        }
        case "missions": {
          void queryClient.invalidateQueries({ queryKey: ["missions"] });
          break;
        }
        case "logs": {
          void queryClient.invalidateQueries({ queryKey: ["logs"] });
          break;
        }
        case "settings": {
          void queryClient.invalidateQueries({ queryKey: ["settings"] });
          break;
        }
        default:
          break;
      }
    });

    return unsubscribe;
  }, [queryClient]);
}