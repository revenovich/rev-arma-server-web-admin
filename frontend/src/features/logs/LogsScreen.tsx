import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { LogEntry } from "@/types/api";

const LOGS_KEY = ["logs"] as const;

export function LogsScreen() {
  const queryClient = useQueryClient();
  const { data: logs, isLoading, error } = useQuery<LogEntry[]>({
    queryKey: LOGS_KEY,
    queryFn: () => api.get<LogEntry[]>("/logs/"),
  });

  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const deleteLog = useMutation({
    mutationFn: (name: string) => api.del(`/logs/${name}`),
    onMutate: (name) => setDeletingFile(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOGS_KEY });
    },
    onSettled: () => setDeletingFile(null),
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-danger">Failed to load logs</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight gradient-heading">Server Logs</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.name}
              className="glass flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium text-text">{log.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.formattedSize} — {log.modified}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`/api/logs/${log.name}/download`}
                  download
                  aria-label={`Download ${log.name}`}
                  className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all"
                >
                  Download
                </a>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => deleteLog.mutate(log.name)}
                  disabled={deletingFile === log.name}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No log files found. Logs appear after running a server.</p>
        </div>
      )}
    </div>
  );
}