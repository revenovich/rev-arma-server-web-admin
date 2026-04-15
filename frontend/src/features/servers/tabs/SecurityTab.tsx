import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";

interface SecurityForm {
  verifySignatures: number;
  allowedFilePatching: number;
  filePatchingExceptions: string;
  allowedLoadFileExtensions: string;
  battle_eye: boolean;
  kickDuplicate: number;
  serverCommandPassword: string;
}

export function SecurityTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [form, setForm] = useState<SecurityForm>({
    verifySignatures: 2,
    allowedFilePatching: 0,
    filePatchingExceptions: "",
    allowedLoadFileExtensions: "",
    battle_eye: true,
    kickDuplicate: 0,
    serverCommandPassword: "",
  });
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    setForm({
      verifySignatures: server.verify_signatures ?? 2,
      allowedFilePatching: server.allowed_file_patching ?? 0,
      filePatchingExceptions: "",
      allowedLoadFileExtensions: "",
      battle_eye: server.battle_eye ?? true,
      kickDuplicate: 0,
      serverCommandPassword: "",
    });
    setInitialized(true);
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      verify_signatures: form.verifySignatures,
      allowed_file_patching: form.allowedFilePatching,
      battle_eye: form.battle_eye,
      kickDuplicate: form.kickDuplicate,
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
      {/* Signatures & File Patching */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Signatures & File Patching</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="verifySignatures" className="text-xs text-muted-foreground">
              Verify Signatures (0=off, 1=v1+v2, 2=v2-only)
            </label>
            <select
              id="verifySignatures"
              value={form.verifySignatures}
              onChange={(e) => setForm((prev) => ({ ...prev, verifySignatures: parseInt(e.target.value) }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value={0}>Off</option>
              <option value={1}>v1 + v2</option>
              <option value={2}>v2 Only</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="allowedFilePatching" className="text-xs text-muted-foreground">
              Allowed File Patching (0=none, 1=HC only, 2=all)
            </label>
            <select
              id="allowedFilePatching"
              value={form.allowedFilePatching}
              onChange={(e) => setForm((prev) => ({ ...prev, allowedFilePatching: parseInt(e.target.value) }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value={0}>None</option>
              <option value={1}>Headless Clients Only</option>
              <option value={2}>All Clients</option>
            </select>
          </div>
        </div>
      </Card>

      {/* BattlEye & Kick */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Anti-Cheat & Kick</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <label id="battle-eye-label" htmlFor="battle_eye" className="text-sm">BattlEye</label>
            <Switch
              id="battle_eye"
              aria-labelledby="battle-eye-label"
              checked={form.battle_eye}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, battle_eye: checked }))}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="kickDuplicate" className="text-xs text-muted-foreground">
              Kick Duplicate Game IDs (0/1)
            </label>
            <Input id="kickDuplicate" type="number" min={0} max={1} value={form.kickDuplicate} onChange={(e) => setForm((prev) => ({ ...prev, kickDuplicate: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
      </Card>

      {/* Server Command Password */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Server Command Password</h3>
        <div className="space-y-1.5">
          <label htmlFor="serverCommandPassword" className="text-xs text-muted-foreground">
            Password for server commands (#login)
          </label>
          <Input
            id="serverCommandPassword"
            type="password"
            placeholder="None"
            value={form.serverCommandPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, serverCommandPassword: e.target.value }))}
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