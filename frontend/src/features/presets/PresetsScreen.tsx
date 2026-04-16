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
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("files", file);
    });
    fetch("/api/presets/upload", { method: "POST", body: formData });
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
        <p className="text-sm text-danger">Failed to load presets</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight gradient-heading">Presets</h1>

      {/* Upload dropzone */}
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label="Upload preset files"
        className={cn(
          "glass flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          isDragActive
            ? "border-indigo-400/40 bg-indigo-500/10"
            : "border-white/20 hover:border-indigo-400/40"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-7 w-7 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {isDragActive ? "Drop preset .html files" : "Drag & drop Arma 3 Launcher .html preset exports"}
        </p>
      </div>

      {/* Presets list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : presets && presets.length > 0 ? (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="glass flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{preset.mods.length} mods</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Load
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
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
          <div className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <FolderGit2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No presets yet. Upload an Arma 3 Launcher .html preset export.
          </p>
        </div>
      )}
    </div>
  );
}