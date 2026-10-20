import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useServer, useUpdateServer } from "@/hooks/useServers";
import { parseWholeNumber } from "@/lib/numbers";
import type { ServerUpdatePayload } from "@/types/api";

const BANDWIDTH_PRESETS: Record<string, Record<string, number>> = {
  "Home 1Mbps": { MinBandwidth: 131072, MaxBandwidth: 1048576, MaxMsgSend: 128, MaxSizeGuaranteed: 512, MaxSizeNonguaranteed: 256, MinPacketSize: 44, MaxPacketSize: 1400 },
  "VPS 10Mbps": { MinBandwidth: 1310720, MaxBandwidth: 10485760, MaxMsgSend: 512, MaxSizeGuaranteed: 1024, MaxSizeNonguaranteed: 512, MinPacketSize: 44, MaxPacketSize: 1400 },
  "Dedicated 100Mbps": { MinBandwidth: 13107200, MaxBandwidth: 104857600, MaxMsgSend: 1024, MaxSizeGuaranteed: 2048, MaxSizeNonguaranteed: 1024, MinPacketSize: 44, MaxPacketSize: 1400 },
  Unlimited: { MinBandwidth: 0, MaxBandwidth: 0, MaxMsgSend: 4096, MaxSizeGuaranteed: 4096, MaxSizeNonguaranteed: 4096, MinPacketSize: 44, MaxPacketSize: 1400 },
};

type NumberKey =
  | "MaxMsgSend"
  | "MaxSizeGuaranteed"
  | "MaxSizeNonguaranteed"
  | "MinBandwidth"
  | "MaxBandwidth"
  | "MinPacketSize"
  | "MaxPacketSize"
  | "MaxPing"
  | "MaxPacketLoss"
  | "MaxDesync"
  | "DisconnectTimeout";

// Number fields hold the raw text so "-1" can be typed; parsed on save
type NetworkForm = Record<NumberKey, string> & { loopback: boolean; upnp: boolean };

const NUMBER_DEFAULTS: Record<NumberKey, number> = {
  MaxMsgSend: 128,
  MaxSizeGuaranteed: 512,
  MaxSizeNonguaranteed: 256,
  MinBandwidth: 131072,
  MaxBandwidth: 1048576,
  MinPacketSize: 44,
  MaxPacketSize: 1400,
  MaxPing: -1,
  MaxPacketLoss: -1,
  MaxDesync: -1,
  DisconnectTimeout: 15,
};

const NUMBER_KEYS = Object.keys(NUMBER_DEFAULTS) as NumberKey[];

function toForm(values: Partial<Record<NumberKey, unknown>>, loopback: boolean, upnp: boolean): NetworkForm {
  const form = { loopback, upnp } as NetworkForm;
  for (const key of NUMBER_KEYS) {
    const value = values[key];
    form[key] = String(typeof value === "number" ? value : NUMBER_DEFAULTS[key]);
  }
  return form;
}

const DEFAULTS: NetworkForm = toForm({}, false, false);

export function NetworkTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [form, setForm] = useState<NetworkForm>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    const s = server as unknown as Record<string, unknown>;
    setForm(toForm(s as Partial<Record<NumberKey, unknown>>, Boolean(s.loopback), Boolean(s.upnp)));
    setInitialized(true);
  }

  function applyPreset(preset: string) {
    const values = BANDWIDTH_PRESETS[preset];
    if (values) {
      setForm((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(values)) next[key as NumberKey] = String(value);
        return next;
      });
    }
  }

  function updateField(key: NumberKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!server) return;
    const payload: Record<string, number | boolean> = { loopback: form.loopback, upnp: form.upnp };
    for (const key of NUMBER_KEYS) {
      const value = parseWholeNumber(form[key]);
      if (value === null) {
        toast.error(`${key} must be a whole number`);
        return;
      }
      payload[key] = value;
    }
    await updateServer.mutateAsync(payload as ServerUpdatePayload);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const numberFields: { key: NumberKey; label: string }[] = [
    { key: "MaxMsgSend", label: "Max Messages Sent" },
    { key: "MaxSizeGuaranteed", label: "Max Size Guaranteed (B)" },
    { key: "MaxSizeNonguaranteed", label: "Max Size Nonguaranteed (B)" },
    { key: "MinBandwidth", label: "Min Bandwidth (Bps)" },
    { key: "MaxBandwidth", label: "Max Bandwidth (Bps)" },
    { key: "MinPacketSize", label: "Min Packet Size (B)" },
    { key: "MaxPacketSize", label: "Max Packet Size (B)" },
  ];

  const networkQualityFields: { key: NumberKey; label: string }[] = [
    { key: "MaxPing", label: "Max Ping Kick (-1 = disabled)" },
    { key: "MaxPacketLoss", label: "Max Packet Loss Kick % (-1 = disabled)" },
    { key: "MaxDesync", label: "Max Desync Kick (-1 = disabled)" },
    { key: "DisconnectTimeout", label: "Disconnect Timeout (s)" },
  ];

  return (
    <div className="space-y-6">
      {/* Bandwidth Presets */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Bandwidth Preset</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(BANDWIDTH_PRESETS).map((preset) => (
            <Button key={preset} variant="secondary" size="sm" onClick={() => applyPreset(preset)}>
              {preset}
            </Button>
          ))}
        </div>
      </Card>

      {/* Basic.cfg fields */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Connection Settings</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {numberFields.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label htmlFor={key} className="text-xs text-muted-foreground">{label}</label>
              <Input id={key} type="number" step={1} value={form[key]} onChange={(e) => updateField(key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      {/* Network quality / kick thresholds */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Network Quality & Kick Thresholds</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {networkQualityFields.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label htmlFor={key} className="text-xs text-muted-foreground">{label}</label>
              <Input id={key} type="number" step={1} value={form[key]} onChange={(e) => updateField(key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      {/* Switches */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Network Options</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <label id="loopback-label" htmlFor="loopback" className="text-sm">Loopback</label>
            <Switch
              id="loopback"
              aria-labelledby="loopback-label"
              checked={form.loopback}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, loopback: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="upnp-label" htmlFor="upnp" className="text-sm">UPnP</label>
            <Switch
              id="upnp"
              aria-labelledby="upnp-label"
              checked={form.upnp}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, upnp: checked }))}
            />
          </div>
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
