import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";

interface AdvancedForm {
  parameters: string[];
  additionalConfigurationOptions: string;
  motd: string;
  motdInterval: number;
}

export function AdvancedTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [form, setForm] = useState<AdvancedForm>({
    parameters: [],
    additionalConfigurationOptions: "",
    motd: "",
    motdInterval: 5,
  });
  const [initialized, setInitialized] = useState(false);
  const [paramInput, setParamInput] = useState("");
  const paramInputRef = useRef<HTMLInputElement>(null);

  if (server && !initialized) {
    setForm({
      parameters: server.parameters ?? [],
      additionalConfigurationOptions: server.additionalConfigurationOptions ?? "",
      motd: server.motd ?? "",
      motdInterval: 5,
    });
    setInitialized(true);
  }

  function addParam() {
    const val = paramInput.trim();
    if (!val) return;
    setForm((prev) => ({ ...prev, parameters: [...prev.parameters, val] }));
    setParamInput("");
    paramInputRef.current?.focus();
  }

  function removeParam(index: number) {
    setForm((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  }

  function handleParamKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addParam();
    }
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      parameters: form.parameters,
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
      {/* Launch Parameters */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Launch Parameters</h3>
        <p className="text-xs text-muted-foreground">
          Command-line arguments passed to the server process on launch (e.g.{" "}
          <code>-port 2302</code>, <code>-profiles</code>).
        </p>
        {form.parameters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.parameters.map((param, i) => (
              <span
                key={`${param}-${i}`}
                className="glass flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-xs"
              >
                {param}
                <button
                  type="button"
                  onClick={() => removeParam(i)}
                  aria-label={`Remove ${param}`}
                  className="ml-0.5 text-muted-foreground hover:text-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={paramInputRef}
            placeholder="-mod @CBA_A3 or -world Altis"
            value={paramInput}
            onChange={(e) => setParamInput(e.target.value)}
            onKeyDown={handleParamKeyDown}
            className="flex-1 font-mono text-sm"
          />
          <Button type="button" variant="secondary" size="sm" onClick={addParam}>
            Add
          </Button>
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
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={form.motd}
            onChange={(e) => setForm((prev) => ({ ...prev, motd: e.target.value }))}
            placeholder={"Line 1\nLine 2"}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="motdInterval" className="text-xs text-muted-foreground">
            MOTD Interval (seconds)
          </label>
          <Input
            id="motdInterval"
            type="number"
            min={0}
            value={form.motdInterval}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, motdInterval: parseInt(e.target.value) || 0 }))
            }
          />
        </div>
      </Card>

      {/* Additional Config Options */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Additional Configuration</h3>
        <div className="space-y-1.5">
          <label htmlFor="additionalConfig" className="text-xs text-muted-foreground">
            Additional configuration options
          </label>
          <textarea
            id="additionalConfig"
            aria-label="Additional configuration options"
            rows={6}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={form.additionalConfigurationOptions}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, additionalConfigurationOptions: e.target.value }))
            }
            placeholder={"kickCommand = \"#kick\";\nbanCommand = \"#ban\";"}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
