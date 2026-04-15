import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Mission } from "@/types/api";

const MISSIONS_KEY = ["missions"] as const;

export function useMissions() {
  return useQuery<Mission[]>({
    queryKey: MISSIONS_KEY,
    queryFn: () => api.get<Mission[]>("/missions/"),
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (name) => api.del(`/missions/${name}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
      toast.success("Mission deleted");
    },
    onError: () => {
      toast.error("Failed to delete mission");
    },
  });
}

export function useRefreshMissions() {
  const queryClient = useQueryClient();
  return useMutation<Mission[], Error, void>({
    mutationFn: () => api.post<Mission[]>("/missions/refresh"),
    onSuccess: (data) => {
      queryClient.setQueryData(MISSIONS_KEY, data);
      toast.success("Missions refreshed");
    },
    onError: () => {
      toast.error("Failed to refresh missions");
    },
  });
}

export function useWorkshopDownload() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean; id: string }, Error, string>({
    mutationFn: (id) => api.post("/missions/workshop", { id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
      toast.success("Workshop download started");
    },
    onError: () => {
      toast.error("Failed to download from Workshop");
    },
  });
}