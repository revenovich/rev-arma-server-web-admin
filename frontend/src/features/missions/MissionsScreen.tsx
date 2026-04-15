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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Missions</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refreshMissions.mutate()}
          disabled={refreshMissions.isPending}
          className="text-xs"
        >
          <RefreshCw className={cn("mr-1.5 h-3 w-3", refreshMissions.isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Upload dropzone */}
      <label
        {...getRootProps({ role: undefined, tabIndex: 0 })}
        htmlFor="mission-upload"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragActive
            ? "border-accent bg-accent/10"
            : "border-border hover:border-accent/40 hover:bg-surface"
        )}
      >
        <input {...getInputProps()} id="mission-upload" />
        <Upload className="h-7 w-7 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {isDragActive ? "Drop .pbo files here" : "Drag & drop .pbo mission files, or click to browse"}
        </p>
      </label>

      {/* Mission list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : missions && missions.length > 0 ? (
        <div className="space-y-2">
          {missions.map((mission) => (
            <div
              key={mission.filename}
              className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{mission.filename}</p>
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
                    "bg-accent/20 border border-accent/40 text-accent hover:bg-accent hover:text-white hover:border-transparent text-xs transition-colors"
                  )}
                >
                  Download
                </a>
                <Button
                  size="sm"
                  className="bg-danger/90 text-white hover:bg-danger border-transparent text-xs"
                  onClick={() => deleteMission.mutate(mission.filename)}
                  disabled={deleteMission.isPending}
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
            <Map className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No mission files found. Upload .pbo files above.</p>
        </div>
      )}
    </div>
  );
}
