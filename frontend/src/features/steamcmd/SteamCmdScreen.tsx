import { Download, RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { SteamCmdVersion } from "@/types/api";

const STEAMCMD_KEY = ["steamcmd"] as const;

export function SteamCmdScreen() {
  const queryClient = useQueryClient();

  const { data: version, isLoading, error } = useQuery<SteamCmdVersion>({
    queryKey: [...STEAMCMD_KEY, "version"],
    queryFn: () => api.get<SteamCmdVersion>("/steamcmd/version"),
  });

  const install = useMutation({
    mutationFn: () => api.post("/steamcmd/install"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STEAMCMD_KEY }),
  });

  const update = useMutation({
    mutationFn: () => api.post("/steamcmd/update"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STEAMCMD_KEY }),
  });

  const [branch, setBranch] = useState("public");

  const switchBranch = useMutation({
    mutationFn: (newBranch: string) => api.post("/steamcmd/branch", { branch: newBranch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STEAMCMD_KEY });
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-danger" />
        <p className="text-danger">Failed to load SteamCMD status</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight gradient-heading">SteamCMD</h1>

      {/* Version / Status */}
      <Card className="space-y-4 p-5">
        <p className="section-label">Installation Status</p>
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : version ? (
          <div className="flex items-center gap-3">
            <Badge variant={version.installed ? "default" : "secondary"}>
              {version.installed ? "Installed" : "Not Installed"}
            </Badge>
            {version.version && (
              <span className="font-mono text-sm text-muted-foreground">
                v{version.version}
              </span>
            )}
          </div>
        ) : null}
      </Card>

      {/* Actions */}
      <Card className="space-y-4 p-5">
        <p className="section-label">Actions</p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => install.mutate()}
            disabled={install.isPending}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {install.isPending ? "Installing..." : "Install"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => update.mutate()}
            disabled={update.isPending}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", update.isPending && "animate-spin")} />
            {update.isPending ? "Updating..." : "Update"}
          </Button>
        </div>
      </Card>

      {/* Branch selector */}
      <Card className="space-y-4 p-5">
        <p className="section-label">Branch</p>
        <div className="flex items-center gap-3">
          <select
            id="branch-select"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="Game branch"
            className="glass-input h-8 px-2.5 text-sm"
          >
            <option value="public">Stable (public)</option>
            <option value="development">Development</option>
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => switchBranch.mutate(branch)}
            disabled={switchBranch.isPending}
          >
            Switch Branch
          </Button>
        </div>
      </Card>
    </div>
  );
}