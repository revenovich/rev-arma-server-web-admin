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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Server Logs</h1>

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {logs.map((log, i) => (
            <div
              key={log.filename}
              className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised ${
                i !== logs.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{log.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.lastModified}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`/api/logs/${log.filename}/download`}
                  download
                  aria-label={`Download ${log.filename}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "bg-accent/15 border border-accent/40 text-accent hover:bg-accent hover:text-white hover:border-accent transition-colors"
                  )}
                >
                  Download
                </a>
                <Button
                  size="sm"
                  className="bg-danger text-white hover:bg-danger/80 border-transparent"
                  onClick={() => deleteLog.mutate(log.filename)}
                  disabled={deletingFile === log.filename}
                  aria-label={`Delete ${log.filename}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No log files found. Logs appear after running a server.</p>
        </div>
      )}
    </div>
  );
}
