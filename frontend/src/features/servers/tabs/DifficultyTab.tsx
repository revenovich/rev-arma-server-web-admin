import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";

const DIFFICULTY_PRESETS = ["Recruit", "Regular", "Veteran", "Custom"] as const;

// Arma 3 difficulty flags (from ServerProfile schema)
const DIFFICULTY_FLAGS = [
  { key: "reducedDamage", label: "Reduced Damage" },
  { key: "staminaBar", label: "Stamina Bar" },
  { key: "vehicleThirdPerson", label: "3rd Person Vehicle" },
  { key: "cameraShake", label: "Camera Shake" },
  { key: "mapContentFriendly", label: "Map Content (Friendly)" },
  { key: "mapContentEnemy", label: "Map Content (Enemy)" },
  { key: "mapContentMine", label: "Map Content (Mines)" },
  { key: "groupIndicators", label: "Group Indicators" },
  { key: "friendlyNameTags", label: "Friendly Name Tags" },
  { key: "enemyNameTags", label: "Enemy Name Tags" },
  { key: "friendlyForceIndicator", label: "Friendly Fire Indicator" },
  { key: "enemyForceIndicator", label: "Enemy Force Indicator" },
  { key: "commands", label: "Commands" },
  { key: "waypoints", label: "Waypoints" },
  { key: "weaponCrosshair", label: "Weapon Crosshair" },
  { key: "visionAid", label: "Vision Aid" },
] as const;

type DifficultyFlags = Record<string, boolean>;

export function DifficultyTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");

  const [forcedDifficulty, setForcedDifficulty] = useState<string>("Regular");
  const [flags, setFlags] = useState<DifficultyFlags>({});
  const [skillAI, setSkillAI] = useState(0.5);
  const [precisionAI, setPrecisionAI] = useState(0.5);
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    setForcedDifficulty(server.forcedDifficulty ?? "Regular");
    setInitialized(true);
  }

  function toggleFlag(key: string) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      forcedDifficulty: forcedDifficulty === "Custom" ? "Custom" : forcedDifficulty,
    });
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

  const isCustom = forcedDifficulty === "Custom";

  return (
    <div className="space-y-6">
      {/* Preset selector */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Difficulty Preset</h3>
        <div className="space-y-1.5">
          <label htmlFor="difficulty-select" className="text-xs text-muted-foreground">
            Forced Difficulty
          </label>
          <select
            id="difficulty-select"
            value={forcedDifficulty}
            onChange={(e) => setForcedDifficulty(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {DIFFICULTY_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Custom flags (only visible when "Custom" is selected) */}
      {isCustom && (
        <>
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-medium text-foreground">Difficulty Flags</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {DIFFICULTY_FLAGS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label id={`flag-${key}-label`} htmlFor={`flag-${key}`} className="text-sm">
                    {label}
                  </label>
                  <Switch
                    id={`flag-${key}`}
                    aria-labelledby={`flag-${key}-label`}
                    checked={flags[key] ?? false}
                    onCheckedChange={() => toggleFlag(key)}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-medium text-foreground">AI Skill</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="skillAI" className="text-xs text-muted-foreground">
                  AI Skill (0–1)
                </label>
                <Input
                  id="skillAI"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={skillAI}
                  onChange={(e) => setSkillAI(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="precisionAI" className="text-xs text-muted-foreground">
                  AI Precision (0–1)
                </label>
                <Input
                  id="precisionAI"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={precisionAI}
                  onChange={(e) => setPrecisionAI(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}