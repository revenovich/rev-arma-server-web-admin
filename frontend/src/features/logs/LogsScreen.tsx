import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { LogEntry } from "@/types/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LOGS_KEY = ["logs"] as const;

export function LogsScreen() {
  const queryClient = useQueryClient();
  const { data: logs, isLoading, error } = useQuery<LogEntry[]>({
    queryKey: LOGS_KEY,
    queryFn: () => api.get<LogEntry[]>("/logs/"),
  });

  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const deleteLog = useMutation({
    mutationFn: (filename: string) => api.del(`/logs/${filename}`),
    onMutate: (filename) => setDeletingFile(filename),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOGS_KEY });
      toast.success("Log deleted");
    },
    onError: () => {
      toast.error("Failed to delete log");
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
      <h1 className="text-xl font-semibold tracking-tight">Server Logs</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.filename}
              className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium text-text">{log.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{log.lastModified}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`/api/logs/${log.filename}/download`}
                  download
                  aria-label={`Download ${log.filename}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "bg-accent/20 border border-accent/40 text-accent hover:bg-accent hover:text-white hover:border-transparent text-xs transition-colors"
                  )}
                >
                  Download
                </a>
                <Button
                  size="sm"
                  className="bg-danger/90 text-white hover:bg-danger border-transparent text-xs"
                  onClick={() => deleteLog.mutate(log.filename)}
                  disabled={deletingFile === log.filename}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No log files found. Logs appear after running a server.</p>
        </div>
      )}
    </div>
  );
}
