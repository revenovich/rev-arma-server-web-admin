import { Map, Upload, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMissions } from "@/hooks/useMissions";
import { cn } from "@/lib/utils";

export function MissionsScreen() {
  const { data: missions, isLoading, error } = useMissions();

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
        <Button variant="secondary" size="sm">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Upload dropzone — use <label> so the file input has a proper label association
          and there is no interactive-inside-interactive violation */}
      <label
        {...getRootProps({ role: undefined, tabIndex: 0 })}
        htmlFor="mission-upload"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
          isDragActive ? "border-accent bg-surface-raised" : "hover:border-muted-foreground/50"
        }`}
      >
        <input {...getInputProps()} id="mission-upload" />
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop .pbo files here" : "Drag & drop .pbo mission files, or click to browse"}
        </p>
      </label>

      {/* Mission list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : missions && missions.length > 0 ? (
        <div className="space-y-2">
          {missions.map((mission) => (
            <Card key={mission.name} className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{mission.name}</p>
                <p className="text-xs text-muted-foreground">
                  {mission.sizeFormatted} — {mission.dateModified}
                </p>
              </div>
              <div className="flex gap-2">
                {/* Use <a> directly to avoid nesting interactive elements inside <button> */}
                <a
                  href={`/api/missions/${mission.name}`}
                  download
                  aria-label={`Download ${mission.name}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Download
                </a>
              </div>
            </Card>
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
