import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";

interface AdvancedForm {
  persistent: boolean;
  autoSelectMission: boolean;
  randomMissionOrder: boolean;
  additionalConfigurationOptions: string;
  motd: string;
  motdInterval: number;
}

export function AdvancedTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [form, setForm] = useState<AdvancedForm>({
    persistent: false,
    autoSelectMission: false,
    randomMissionOrder: false,
    additionalConfigurationOptions: "",
    motd: "",
    motdInterval: 5,
  });
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    setForm({
      persistent: server.persistent ?? false,
      autoSelectMission: false,
      randomMissionOrder: false,
      additionalConfigurationOptions: server.additionalConfigurationOptions ?? "",
      motd: server.motd ?? "",
      motdInterval: 5,
    });
    setInitialized(true);
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      persistent: form.persistent,
      additionalConfigurationOptions: form.additionalConfigurationOptions || null,
      motd: form.motd || null,
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
      {/* Lifecycle */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Lifecycle</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <label id="persistent-label" htmlFor="persistent" className="text-sm">Persistent Mission</label>
            <Switch id="persistent" aria-labelledby="persistent-label" checked={form.persistent} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, persistent: checked }))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="motdInterval" className="text-xs text-muted-foreground">
              MOTD Interval (seconds)
            </label>
            <Input id="motdInterval" type="number" min={0} value={form.motdInterval} onChange={(e) => setForm((prev) => ({ ...prev, motdInterval: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
      </Card>

      {/* MOTD */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Message of the Day</h3>
        <div className="space-y-1.5">
          <label htmlFor="motd" className="text-xs text-muted-foreground">
            MOTD (one line per message)
          </label>
          <textarea
            id="motd"
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={form.motd}
            onChange={(e) => setForm((prev) => ({ ...prev, motd: e.target.value }))}
            placeholder="Line 1&#10;Line 2"
          />
        </div>
      </Card>

      {/* Additional Config Options */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Additional Configuration</h3>
        <div className="space-y-1.5">
          <label htmlFor="additionalConfig" className="text-xs text-muted-foreground">
            Free-form server.cfg lines (one per line)
          </label>
          <textarea
            id="additionalConfig"
            rows={6}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={form.additionalConfigurationOptions}
            onChange={(e) => setForm((prev) => ({ ...prev, additionalConfigurationOptions: e.target.value }))}
            placeholder="kickCommand = &quot;#kick&quot;;&#10;banCommand = &quot;#ban&quot;;"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}