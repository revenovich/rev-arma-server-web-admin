import { Map, Upload, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMissions, useDeleteMission, useRefreshMissions } from "@/hooks/useMissions";
import { cn } from "@/lib/utils";

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
        <h1 className="text-2xl font-bold tracking-tight gradient-heading">Missions</h1>
        <Button
          variant="outline"
          size="sm"
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
          "glass flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors",
          isDragActive
            ? "border-indigo-400/40 bg-indigo-500/10"
            : "border-white/20 hover:border-indigo-400/40"
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
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : missions && missions.length > 0 ? (
        <div className="space-y-2">
          {missions.map((mission) => (
            <div
              key={mission.name}
              className="glass flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/10"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-text">{mission.missionName}</p>
                  {mission.worldName && (
                    <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                      {mission.worldName}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mission.sizeFormatted} — {mission.dateModified}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`/api/missions/${mission.name}`}
                  download
                  aria-label={`Download ${mission.name}`}
                  className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all"
                >
                  Download
                </a>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => deleteMission.mutate(mission.name)}
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
          <div className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <Map className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No mission files found. Upload .pbo files above.</p>
        </div>
      )}
    </div>
  );
}