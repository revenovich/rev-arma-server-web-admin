import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const SETTINGS_KEY = ["settings"] as const;

export function SettingsScreen() {
  const { data: settings, isLoading, error } = useQuery<Record<string, unknown>>({
    queryKey: SETTINGS_KEY,
    queryFn: () => api.get<Record<string, unknown>>("/settings/"),
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-danger">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : settings ? (
        <div className="space-y-2">
          {Object.entries(settings).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 hover:bg-surface-raised transition-colors"
            >
              <span className="text-sm font-medium text-text">{key}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {value === null ? "—" : String(value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No settings available.</p>
        </div>
      )}
    </div>
  );
}
