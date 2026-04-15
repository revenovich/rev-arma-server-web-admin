import { Map, Upload, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMissions, useDeleteMission, useRefreshMissions } from "@/hooks/useMissions";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function MissionsScreen() {
  const { data: missions, isLoading, error } = useMissions();
  const deleteMission = useDeleteMission();
  const refreshMissions = useRefreshMissions();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const formData = new FormData();
    acceptedFiles.forEach((file) => formData.append("files", file));
    fetch("/api/missions", { method: "POST", body: formData });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/octet-stream": [".pbo"] },
    multiple: true,
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-danger">Failed to load missions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Missions</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refreshMissions.mutate()}
          disabled={refreshMissions.isPending}
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshMissions.isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Upload dropzone */}
      <label
        {...getRootProps({ role: undefined, tabIndex: 0 })}
        htmlFor="mission-upload"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          isDragActive
            ? "border-accent bg-accent/10 text-accent"
            : "border-border hover:border-accent/50 hover:bg-surface-raised"
        )}
      >
        <input {...getInputProps()} id="mission-upload" />
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop .pbo files here" : "Drag & drop .pbo mission files, or click to browse"}
        </p>
      </label>

      {/* Mission list */}
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : missions && missions.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {missions.map((mission, i) => (
            <div
              key={mission.filename}
              className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised ${
                i !== missions.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{mission.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(mission.size)} — {mission.lastModified}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`/api/missions/${mission.filename}`}
                  download
                  aria-label={`Download ${mission.filename}`}
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
                  onClick={() => deleteMission.mutate(mission.filename)}
                  disabled={deleteMission.isPending}
                  aria-label={`Delete ${mission.filename}`}
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
            <Map className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No mission files found. Upload .pbo files above.</p>
        </div>
      )}
    </div>
  );
}
