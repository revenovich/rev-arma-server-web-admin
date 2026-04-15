import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer, useUpdateServer } from "@/hooks/useServers";
import { useMods } from "@/hooks/useMods";

export function ModsTab() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: server, isLoading } = useServer(id ?? "");
  const updateServer = useUpdateServer(id ?? "");
  const { data: allMods, isLoading: modsLoading } = useMods();

  const [selected, setSelected] = useState<string[]>([]);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [activeMods, setActiveMods] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (server && !initialized) {
    setActiveMods([...(server.mods ?? [])]);
    setInitialized(true);
  }

  const activeSet = new Set(activeMods);

  // Available = all mods not in activeMods
  const availableMods = useMemo(
    () => (allMods ?? []).filter((m) => !activeSet.has(m.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allMods, activeMods],
  );

  const filteredActive = useMemo(() => {
    if (!rightSearch) return activeMods;
    const q = rightSearch.toLowerCase();
    return activeMods.filter((m) => m.toLowerCase().includes(q));
  }, [activeMods, rightSearch]);

  const filteredAvailable = useMemo(() => {
    if (!leftSearch) return availableMods;
    const q = leftSearch.toLowerCase();
    return availableMods.filter((m) => m.name.toLowerCase().includes(q));
  }, [availableMods, leftSearch]);

  function handleMoveToActive() {
    const toAdd = selected.filter((s) => availableMods.some((m) => m.name === s));
    setActiveMods((prev) => [...prev, ...toAdd]);
    setSelected([]);
  }

  function handleMoveToAvailable() {
    setActiveMods((prev) => prev.filter((m) => !selected.includes(m)));
    setSelected([]);
  }

  function toggleSelect(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ["mods"] });
  }

  async function handleSave() {
    if (!server) return;
    await updateServer.mutateAsync({ mods: activeMods });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Available mods (left) */}
        <Card className="flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-label">Available Mods</h3>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh mods"
              onClick={handleRefresh}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={leftSearch}
              onChange={(e) => setLeftSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {modsLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : filteredAvailable.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No mods available</p>
            ) : (
              filteredAvailable.map((mod) => (
                <button
                  key={mod.name}
                  type="button"
                  onClick={() => toggleSelect(mod.name)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    selected.includes(mod.name)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-white/10"
                  }`}
                >
                  <span className="truncate font-mono">{mod.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {mod.formattedSize}
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Active mods (right) */}
        <Card className="flex flex-col p-4">
          <div className="mb-3">
            <h3 className="section-label">Active Mods</h3>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={rightSearch}
              onChange={(e) => setRightSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {filteredActive.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No active mods</p>
            ) : (
              filteredActive.map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleSelect(mod)}
                  className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    selected.includes(mod)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-white/10"
                  }`}
                >
                  <span className="truncate font-mono">{mod}</span>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Transfer buttons */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleMoveToActive}
          disabled={!selected.some((s) => availableMods.some((m) => m.name === s))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Activate
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleMoveToAvailable}
          disabled={!selected.some((s) => activeMods.includes(s))}
        >
          Deactivate
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateServer.isPending}>
          {updateServer.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
