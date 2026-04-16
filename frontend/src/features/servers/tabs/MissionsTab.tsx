import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";
import { useMissions } from "@/hooks/useMissions";
import type { ServerUpdatePayload } from "@/types/api";

const DIFFICULTY_OPTIONS = ["Recruit", "Regular", "Veteran", "Custom"] as const;
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

interface MissionEntry {
  template: string;
  difficulty: Difficulty;
  params: string[];
}

function parseMissions(raw: unknown[]): MissionEntry[] {
  return raw.map((m) => {
    if (typeof m === "string") return { template: m, difficulty: "Regular", params: [] };
    if (typeof m === "object" && m !== null) {
      const obj = m as Record<string, unknown>;
      return {
        template: String(obj.template ?? obj.missionName ?? m),
        difficulty: (DIFFICULTY_OPTIONS as readonly string[]).includes(String(obj.difficulty))
          ? (obj.difficulty as Difficulty)
          : "Regular",
        params: Array.isArray(obj.params) ? obj.params.map(String) : [],
      };
    }
    return { template: String(m), difficulty: "Regular", params: [] };
  });
}

interface SortableItemProps {
  entry: MissionEntry;
  onRemove: (template: string) => void;
  onDifficultyChange: (template: string, difficulty: Difficulty) => void;
  onAddParam: (template: string, param: string) => void;
  onRemoveParam: (template: string, paramIndex: number) => void;
}

function SortableItem({ entry, onRemove, onDifficultyChange, onAddParam, onRemoveParam }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: entry.template,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [paramInput, setParamInput] = useState("");

  function handleParamKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = paramInput.trim();
      if (val) {
        onAddParam(entry.template, val);
        setParamInput("");
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass space-y-2 rounded-xl border border-white/10 px-3 py-2 text-sm"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex-1 truncate font-mono">{entry.template}</span>
        <select
          value={entry.difficulty}
          onChange={(e) => onDifficultyChange(entry.template, e.target.value as Difficulty)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:border-ring focus-visible:outline-none"
          aria-label={`Difficulty for ${entry.template}`}
        >
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(entry.template)}
          className="text-muted-foreground hover:text-danger"
          aria-label={`Remove ${entry.template}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Per-mission parameters */}
      {entry.params.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {entry.params.map((param, i) => (
            <span
              key={`${param}-${i}`}
              className="glass flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[11px]"
            >
              {param}
              <button
                type="button"
                onClick={() => onRemoveParam(entry.template, i)}
                className="text-muted-foreground hover:text-danger"
                aria-label={`Remove param ${param}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1 pl-6">
        <input
          type="text"
          placeholder="Add param (e.g. viewDistance = 3000)"
          value={paramInput}
          onChange={(e) => setParamInput(e.target.value)}
          onKeyDown={handleParamKeyDown}
          className="flex-1 rounded border border-input bg-transparent px-2 py-0.5 font-mono text-xs focus-visible:border-ring focus-visible:outline-none"
          aria-label={`Add parameter for ${entry.template}`}
        />
      </div>
    </div>
  );
}

export function MissionsTab() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");
  const { data: availableMissions, isLoading: missionsLoading } = useMissions();

  const [rotation, setRotation] = useState<MissionEntry[]>([]);
  const [rotationInitialized, setRotationInitialized] = useState(false);

  if (server && !rotationInitialized) {
    setRotation(parseMissions(server.missions ?? []));
    setRotationInitialized(true);
  }

  const [autoSelectMission, setAutoSelectMission] = useState(false);
  const [randomMissionOrder, setRandomMissionOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRotation((prev) => {
        const oldIndex = prev.findIndex((m) => m.template === String(active.id));
        const newIndex = prev.findIndex((m) => m.template === String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleRemoveFromRotation(template: string) {
    setRotation((prev) => prev.filter((m) => m.template !== template));
  }

  function handleAddToRotation(template: string) {
    setRotation((prev) => [...prev, { template, difficulty: "Regular", params: [] }]);
  }

  function handleDifficultyChange(template: string, difficulty: Difficulty) {
    setRotation((prev) =>
      prev.map((m) => (m.template === template ? { ...m, difficulty } : m)),
    );
  }

  function handleAddParam(template: string, param: string) {
    setRotation((prev) =>
      prev.map((m) =>
        m.template === template ? { ...m, params: [...m.params, param] } : m,
      ),
    );
  }

  function handleRemoveParam(template: string, paramIndex: number) {
    setRotation((prev) =>
      prev.map((m) =>
        m.template === template
          ? { ...m, params: m.params.filter((_, i) => i !== paramIndex) }
          : m,
      ),
    );
  }

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ["missions"] });
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({
      missions: rotation,
      autoSelectMission,
      randomMissionOrder,
    } as ServerUpdatePayload);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const rotationTemplates = new Set(rotation.map((m) => m.template));

  return (
    <div className="space-y-6">
      {/* Toggles */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Mission Settings</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <label id="auto-select-label" htmlFor="autoSelectMission" className="text-sm">
              Auto Select Mission
            </label>
            <Switch
              id="autoSelectMission"
              aria-labelledby="auto-select-label"
              checked={autoSelectMission}
              onCheckedChange={setAutoSelectMission}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="random-order-label" htmlFor="randomMissionOrder" className="text-sm">
              Random Mission Order
            </label>
            <Switch
              id="randomMissionOrder"
              aria-labelledby="random-order-label"
              checked={randomMissionOrder}
              onCheckedChange={setRandomMissionOrder}
            />
          </div>
        </div>
      </Card>

      {/* Rotation list */}
      <Card className="space-y-4 p-5">
        <h3 className="section-label">Mission Rotation</h3>
        {rotation.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No missions in rotation. Add missions from the available list below.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rotation.map((m) => m.template)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {rotation.map((entry) => (
                  <SortableItem
                    key={entry.template}
                    entry={entry}
                    onRemove={handleRemoveFromRotation}
                    onDifficultyChange={handleDifficultyChange}
                    onAddParam={handleAddParam}
                    onRemoveParam={handleRemoveParam}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {/* Available missions */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="section-label">Available Missions</h3>
          <Button variant="secondary" size="sm" onClick={handleRefresh} aria-label="Refresh missions">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        {missionsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : availableMissions && availableMissions.length > 0 ? (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {availableMissions
              .filter((m) => !rotationTemplates.has(m.name))
              .map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => handleAddToRotation(m.name)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
                >
                  <span className="truncate font-mono">{m.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {m.worldName} · {m.sizeFormatted}
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No mission files found. Upload .pbo files to the missions directory.
          </p>
        )}
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
