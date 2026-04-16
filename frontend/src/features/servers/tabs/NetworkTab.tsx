import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";
import type { ServerUpdatePayload } from "@/types/api";

const BANDWIDTH_PRESETS: Record<string, Record<string, number>> = {
  "Home 1Mbps": { MinBandwidth: 131072, MaxBandwidth: 1048576, MaxMsgSend: 128, MaxSizeGuaranteed: 512, MaxSizeNonguaranteed: 256, MinPacketSize: 44, MaxPacketSize: 1400 },
  "VPS 10Mbps": { MinBandwidth: 1310720, MaxBandwidth: 10485760, MaxMsgSend: 512, MaxSizeGuaranteed: 1024, MaxSizeNonguaranteed: 512, MinPacketSize: 44, MaxPacketSize: 1400 },
  "Dedicated 100Mbps": { MinBandwidth: 13107200, MaxBandwidth: 104857600, MaxMsgSend: 1024, MaxSizeGuaranteed: 2048, MaxSizeNonguaranteed: 1024, MinPacketSize: 44, MaxPacketSize: 1400 },
  Unlimited: { MinBandwidth: 0, MaxBandwidth: 0, MaxMsgSend: 4096, MaxSizeGuaranteed: 4096, MaxSizeNonguaranteed: 4096, MinPacketSize: 44, MaxPacketSize: 1400 },
};

interface NetworkForm {
  MaxMsgSend: number;
  MaxSizeGuaranteed: number;
  MaxSizeNonguaranteed: number;
  MinBandwidth: number;
  MaxBandwidth: number;
  MinPacketSize: number;
  MaxPacketSize: number;
  MaxPing: number;
  MaxPacketLoss: number;
  MaxDesync: number;
  DisconnectTimeout: number;
  loopback: boolean;
  upnp: boolean;
}

const DEFAULTS: NetworkForm = {
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
  loopback: false,
  upnp: false,
};

export function NetworkTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [form, setForm] = useState<NetworkForm>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    const s = server as Record<string, unknown>;
    setForm({
      MaxMsgSend: (s.MaxMsgSend as number) ?? DEFAULTS.MaxMsgSend,
      MaxSizeGuaranteed: (s.MaxSizeGuaranteed as number) ?? DEFAULTS.MaxSizeGuaranteed,
      MaxSizeNonguaranteed: (s.MaxSizeNonguaranteed as number) ?? DEFAULTS.MaxSizeNonguaranteed,
      MinBandwidth: (s.MinBandwidth as number) ?? DEFAULTS.MinBandwidth,
      MaxBandwidth: (s.MaxBandwidth as number) ?? DEFAULTS.MaxBandwidth,
      MinPacketSize: (s.MinPacketSize as number) ?? DEFAULTS.MinPacketSize,
      MaxPacketSize: (s.MaxPacketSize as number) ?? DEFAULTS.MaxPacketSize,
      MaxPing: (s.MaxPing as number) ?? DEFAULTS.MaxPing,
      MaxPacketLoss: (s.MaxPacketLoss as number) ?? DEFAULTS.MaxPacketLoss,
      MaxDesync: (s.MaxDesync as number) ?? DEFAULTS.MaxDesync,
      DisconnectTimeout: (s.DisconnectTimeout as number) ?? DEFAULTS.DisconnectTimeout,
      loopback: Boolean(s.loopback),
      upnp: Boolean(s.upnp),
    });
    setInitialized(true);
  }

  function applyPreset(preset: string) {
    const values = BANDWIDTH_PRESETS[preset];
    if (values) {
      setForm((prev) => ({ ...prev, ...values }));
    }
  }

  function updateField(key: keyof NetworkForm, value: number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync(form as unknown as ServerUpdatePayload);
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

  const numberFields: { key: keyof NetworkForm; label: string }[] = [
    { key: "MaxMsgSend", label: "Max Messages Sent" },
    { key: "MaxSizeGuaranteed", label: "Max Size Guaranteed (B)" },
    { key: "MaxSizeNonguaranteed", label: "Max Size Nonguaranteed (B)" },
    { key: "MinBandwidth", label: "Min Bandwidth (Bps)" },
    { key: "MaxBandwidth", label: "Max Bandwidth (Bps)" },
    { key: "MinPacketSize", label: "Min Packet Size (B)" },
    { key: "MaxPacketSize", label: "Max Packet Size (B)" },
  ];

  const networkQualityFields: { key: keyof NetworkForm; label: string }[] = [
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
              <Input id={key} type="number" value={form[key] as number} onChange={(e) => updateField(key, parseInt(e.target.value) || 0)} />
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
              <Input id={key} type="number" value={form[key] as number} onChange={(e) => updateField(key, parseInt(e.target.value) || 0)} />
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
