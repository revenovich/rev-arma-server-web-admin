import { FolderGit2, Upload, AlertTriangle } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Preset } from "@/types/api";
import { cn } from "@/lib/utils";

const PRESETS_KEY = ["presets"] as const;

export function PresetsScreen() {
  const { data: presets, isLoading, error } = useQuery<Preset[]>({
    queryKey: PRESETS_KEY,
    queryFn: () => api.get<Preset[]>("/presets/"),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const formData = new FormData();
      formData.append("file", file);
      fetch("/api/presets/upload", { method: "POST", body: formData });
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/html": [".html"] },
    multiple: true,
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-danger" />
        <p className="text-danger">Failed to load presets</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Presets</h1>

      {/* Upload dropzone */}
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label="Upload preset files"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          isDragActive
            ? "border-accent bg-accent/10 text-accent"
            : "border-border hover:border-accent/50 hover:bg-surface-raised"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop preset .html files" : "Drag & drop Arma 3 Launcher .html preset exports"}
        </p>
      </div>

      {/* Presets list */}
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : presets && presets.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {presets.map((preset, i) => (
            <div
              key={preset.id}
              className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised ${
                i !== presets.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {preset.mods.length} mods
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  className="bg-accent/15 border border-accent/40 text-accent hover:bg-accent hover:text-white hover:border-accent transition-colors"
                >
                  Load
                </Button>
                <Button
                  size="sm"
                  className="bg-danger text-white hover:bg-danger/80 border-transparent"
                  aria-label={`Delete ${preset.name}`}
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
            <FolderGit2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No presets yet. Upload an Arma 3 Launcher .html preset export.
          </p>
        </div>
      )}
    </div>
  );
}
