import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";

export function HeadlessTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [hcCount, setHcCount] = useState(0);
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    setHcCount(server.number_of_headless_clients ?? 0);
    setInitialized(true);
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      number_of_headless_clients: hcCount,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Headless Clients</h3>
        <div className="space-y-1.5">
          <label htmlFor="hcCount" className="text-xs text-muted-foreground">
            Number of Headless Clients
          </label>
          <Input
            id="hcCount"
            type="number"
            min={0}
            max={16}
            value={hcCount}
            onChange={(e) => setHcCount(parseInt(e.target.value) || 0)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Headless clients connect without rendering and offload AI processing from the server.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Headless Client IPs</h3>
        <p className="text-xs text-muted-foreground">
          Configure headless client and local client IP addresses in the Advanced tab or via server.cfg.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}