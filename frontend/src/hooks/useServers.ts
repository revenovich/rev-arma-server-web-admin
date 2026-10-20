import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type {
  Server,
  ServerCreatePayload,
  ServerUpdatePayload,
} from "@/types/api";

const SERVERS_KEY = ["servers"] as const;

export function useServers() {
  return useQuery<Server[]>({
    queryKey: SERVERS_KEY,
    queryFn: () => api.get<Server[]>("/servers/"),
  });
}

export function useServer(id: string) {
  return useQuery<Server>({
    queryKey: [...SERVERS_KEY, id],
    queryFn: () => api.get<Server>(`/servers/${id}`),
    enabled: !!id,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  return useMutation<Server, Error, ServerCreatePayload>({
    mutationFn: (payload) => api.post<Server>("/servers/", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVERS_KEY });
      toast.success("Server created");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to create server"));
    },
  });
}

export function useUpdateServer(id: string) {
  const queryClient = useQueryClient();
  return useMutation<Server, Error, ServerUpdatePayload>({
    mutationFn: (payload) => api.put<Server>(`/servers/${id}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVERS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...SERVERS_KEY, id] });
      toast.success("Server updated");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to update server"));
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (serverId) => api.del(`/servers/${serverId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVERS_KEY });
      toast.success("Server deleted");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to delete server"));
    },
  });
}

interface StartResult {
  status: "ok" | "already_running";
  pid: number | null;
  /** Mods left out of `-mod=`: missing on disk, or with a `;` in the name */
  skipped_mods?: string[];
}

export function useStartServer(id: string) {
  const queryClient = useQueryClient();
  return useMutation<StartResult, Error, void>({
    mutationFn: () => api.post<StartResult>(`/servers/${id}/start`),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: SERVERS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...SERVERS_KEY, id] });
      if (result.status === "already_running") {
        toast.info("Server is already running");
        return;
      }
      toast.success("Server starting");
      const skipped = result.skipped_mods ?? [];
      if (skipped.length > 0) {
        toast.warning(`Started without mods that are missing or unusable: ${skipped.join(", ")}`);
      }
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to start server"));
    },
  });
}

export function useStopServer(id: string) {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; pid: number | null }, Error, void>({
    mutationFn: () => api.post(`/servers/${id}/stop`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVERS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...SERVERS_KEY, id] });
      toast.success("Server stopping");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to stop server"));
    },
  });
}