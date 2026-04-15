import { FolderGit2, Upload, AlertTriangle } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Preset } from "@/types/api";

const PRESETS_KEY = ["presets"] as const;

export function PresetsScreen() {
  const { data: presets, isLoading, error } = useQuery<Preset[]>({
    queryKey: PRESETS_KEY,
    queryFn: () => api.get<Preset[]>("/presets"),
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
          isDragActive ? "border-accent bg-surface-raised" : "hover:border-muted-foreground/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop preset .html files" : "Drag & drop Arma 3 Launcher .html preset exports"}
        </p>
      </div>

      {/* Presets list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : presets && presets.length > 0 ? (
        <div className="space-y-2">
          {presets.map((preset) => (
            <Card key={preset.id} className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preset.mods.length} mods
                </p>
              </div>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Card>
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