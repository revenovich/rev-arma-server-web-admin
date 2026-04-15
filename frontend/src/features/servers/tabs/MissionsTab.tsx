import { useState } from "react";
import { useParams } from "react-router-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";
import { useMissions } from "@/hooks/useMissions";
import type { ServerUpdatePayload } from "@/types/api";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function SortableItem({ id, onRemove }: { id: string; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 truncate font-mono">{id}</span>
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="text-muted-foreground hover:text-danger"
        aria-label={`Remove ${id}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MissionsTab() {
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");
  const { data: availableMissions, isLoading: missionsLoading } = useMissions();

  // Rotation list state
  const [rotation, setRotation] = useState<string[]>([]);
  const [rotationInitialized, setRotationInitialized] = useState(false);

  // Sync rotation from server data
  if (server && !rotationInitialized) {
    const serverMissions = (server.missions ?? []).map((m: unknown) =>
      typeof m === "string" ? m : (m as { missionName?: string }).missionName ?? String(m),
    );
    setRotation(serverMissions);
    setRotationInitialized(true);
  }

  // Toggles
  const [autoSelectMission, setAutoSelectMission] = useState(false);
  const [randomMissionOrder, setRandomMissionOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRotation((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleRemoveFromRotation(missionName: string) {
    setRotation((prev) => prev.filter((m) => m !== missionName));
  }

  function handleAddToRotation(missionName: string) {
    setRotation((prev) => [...prev, missionName]);
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

  const rotationSet = new Set(rotation);

  return (
    <div className="space-y-6">
      {/* Toggles */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-foreground">Mission Settings</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <label id="auto-select-label" htmlFor="autoSelectMission" className="text-sm">Auto Select Mission</label>
            <Switch
              id="autoSelectMission"
              aria-labelledby="auto-select-label"
              checked={autoSelectMission}
              onCheckedChange={setAutoSelectMission}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label id="random-order-label" htmlFor="randomMissionOrder" className="text-sm">Random Mission Order</label>
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
        <h3 className="text-sm font-medium text-foreground">Mission Rotation</h3>
        {rotation.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missions in rotation. Add missions from the available list.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rotation} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {rotation.map((mission) => (
                  <SortableItem
                    key={mission}
                    id={mission}
                    onRemove={handleRemoveFromRotation}
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
          <h3 className="text-sm font-medium text-foreground">Available Missions</h3>
          <Button variant="secondary" size="sm">
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
              .filter((m) => !rotationSet.has(m.filename))
              .map((m) => (
                <button
                  key={m.filename}
                  type="button"
                  onClick={() => handleAddToRotation(m.filename)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-raised"
                >
                  <span className="truncate font-mono">{m.filename}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(m.size)}</span>
                </button>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No mission files found. Upload .pbo files to the missions directory.</p>
        )}
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}