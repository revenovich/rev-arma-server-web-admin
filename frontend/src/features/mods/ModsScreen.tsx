import { Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <div className="space-y-2">
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
      <h1 className="text-2xl font-semibold tracking-tight">Mods</h1>

      {hasMods ? (
        <div className="space-y-2">
          {mods.map((mod) => (
            <Card key={mod.name} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm">{mod.name}</span>
                  {mod.steamId && (
                    <Badge variant="secondary" className="font-mono text-xs shrink-0">
                      Steam
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(mod.size)}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" aria-label={`Delete ${mod.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
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