import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <h1 className="text-xl font-semibold tracking-tight">Mods</h1>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasMods = mods && mods.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Mods</h1>
        {hasMods && (
          <span className="text-xs text-muted-foreground">{mods.length} installed</span>
        )}
      </div>

      {hasMods ? (
        <div className="space-y-2">
          {mods.map((mod) => (
            <div
              key={mod.name}
              className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 transition-colors hover:bg-surface-raised"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text">{mod.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.formattedSize}</p>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-danger/90 text-white hover:bg-danger border-transparent text-xs"
                aria-label={`Delete ${mod.name}`}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No mods found</p>
            <p className="text-xs text-muted-foreground">
              Mod folders appear here once placed in the mods directory.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
