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
  file_patching: boolean;
  battle_eye: boolean;
  kickDuplicate: boolean;
  serverCommandPassword: string;
  filePatchingExceptions: string;
  allowedLoadFileExtensions: string;
}

export function SecurityTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [form, setForm] = useState<SecurityForm>({
    verifySignatures: 2,
    allowedFilePatching: 0,
    file_patching: false,
    battle_eye: true,
    kickDuplicate: false,
    serverCommandPassword: "",
    filePatchingExceptions: "",
    allowedLoadFileExtensions: "",
  });
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    const s = server as Record<string, unknown>;
    setForm({
      verifySignatures: (s.verify_signatures as number) ?? 2,
      allowedFilePatching: (s.allowed_file_patching as number) ?? 0,
      file_patching: (s.file_patching as boolean) ?? false,
      battle_eye: (s.battle_eye as boolean) ?? true,
      kickDuplicate: Boolean(s.kickDuplicate),
      serverCommandPassword: (s.serverCommandPassword as string) ?? "",
      filePatchingExceptions: ((s.filePatchingExceptions as string[]) ?? []).join("\n"),
      allowedLoadFileExtensions: ((s.allowedLoadFileExtensions as string[]) ?? []).join("\n"),
    });
    setInitialized(true);
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      verify_signatures: form.verifySignatures,
      allowed_file_patching: form.allowedFilePatching,
      file_patching: form.file_patching,
      battle_eye: form.battle_eye,
      kickDuplicate: form.kickDuplicate ? 1 : 0,
      serverCommandPassword: form.serverCommandPassword || null,
      filePatchingExceptions: form.filePatchingExceptions
        ? form.filePatchingExceptions.split("\n").filter(Boolean)
        : [],
      allowedLoadFileExtensions: form.allowedLoadFileExtensions
        ? form.allowedLoadFileExtensions.split("\n").filter(Boolean)
        : [],
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
        <h3 className="section-label">Signatures & File Patching</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="verifySignatures" className="text-xs text-muted-foreground">
              Verify Signatures
            </label>
            <p className="text-[11px] text-muted-foreground/70">
              Controls signature checking for mod PBO files. Off = no check, v1+v2 = both versions, v2 Only = Arma 3 format only.
            </p>
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
              Allowed File Patching
            </label>
            <p className="text-[11px] text-muted-foreground/70">
              Who can use file patching. None = disabled, HC Only = headless clients, All = all clients.
            </p>
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <label id="file-patching-label" htmlFor="file_patching" className="text-sm">Enable File Patching</label>
            <p className="text-[11px] text-muted-foreground/70">
              Adds -filePatching to the server command line. Must be enabled for allowedFilePatching to take effect.
            </p>
          </div>
          <Switch
            id="file_patching"
            aria-labelledby="file-patching-label"
            checked={form.file_patching}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, file_patching: checked }))}
          />
        </div>
      </Card>

      {/* BattlEye & Kick */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Anti-Cheat & Kick</h3>
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
          <div className="flex items-center justify-between gap-3">
            <label id="kick-duplicate-label" htmlFor="kickDuplicate" className="text-sm">Kick Duplicate Game IDs</label>
            <Switch
              id="kickDuplicate"
              aria-labelledby="kick-duplicate-label"
              checked={form.kickDuplicate}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, kickDuplicate: checked }))}
            />
          </div>
        </div>
      </Card>

      {/* Server Command Password */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Server Command Password</h3>
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

      {/* File Patching Exceptions & Load Extensions */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">File Patching Details</h3>
        <div className="space-y-1.5">
          <label htmlFor="filePatchingExceptions" className="text-xs text-muted-foreground">
            File Patching Exceptions (one per line)
          </label>
          <textarea
            id="filePatchingExceptions"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={form.filePatchingExceptions}
            onChange={(e) => setForm((prev) => ({ ...prev, filePatchingExceptions: e.target.value }))}
            placeholder={"@CBA_A3\n@ace"}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="allowedLoadFileExtensions" className="text-xs text-muted-foreground">
            Allowed Load File Extensions (one per line)
          </label>
          <textarea
            id="allowedLoadFileExtensions"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={form.allowedLoadFileExtensions}
            onChange={(e) => setForm((prev) => ({ ...prev, allowedLoadFileExtensions: e.target.value }))}
            placeholder={".paa\n.hpp"}
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
