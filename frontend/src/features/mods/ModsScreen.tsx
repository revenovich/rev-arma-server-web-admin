import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMods } from "@/hooks/useMods";

export function ModsScreen() {
  const { data: mods, isLoading, error } = useMods();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-danger">Failed to load mods</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mods</h1>
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasMods = mods && mods.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mods</h1>
        {hasMods && (
          <span className="text-sm text-muted-foreground">{mods.length} mods</span>
        )}
      </div>

      {hasMods ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {mods.map((mod, i) => (
            <div
              key={mod.name}
              className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised ${
                i !== mods.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium">{mod.name}</span>
                  {mod.steamId && (
                    <Badge variant="secondary" className="font-mono text-xs shrink-0 bg-accent/15 text-accent border-accent/30">
                      Steam
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(mod.size)}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-danger text-white hover:bg-danger/80 border-transparent"
                aria-label={`Delete ${mod.name}`}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No mods found</p>
            <p className="text-xs text-muted-foreground">
              Mod folders will appear here once they are in the mods directory.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
