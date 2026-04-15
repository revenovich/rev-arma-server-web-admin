import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { LogEntry } from "@/types/api";
import { cn } from "@/lib/utils";

const LOGS_KEY = ["logs"] as const;

export function LogsScreen() {
  const { data: logs, isLoading, error } = useQuery<LogEntry[]>({
    queryKey: LOGS_KEY,
    queryFn: () => api.get<LogEntry[]>("/logs/"),
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
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.filename} className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{log.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {log.lastModified}
                </p>
              </div>
              <div className="flex gap-2">
                {/* Use <a> directly — <Button asChild> nests <button><a> which fails a11y */}
                <a
                  href={`/api/logs/${log.filename}/download`}
                  download
                  aria-label={`Download ${log.filename}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  <Download className="h-4 w-4" />
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-danger"
                  aria-label={`Delete ${log.filename}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
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
