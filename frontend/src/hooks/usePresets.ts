import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Preset } from "@/types/api";

const PRESETS_KEY = ["presets"] as const;

export function usePresets() {
  return useQuery<Preset[]>({
    queryKey: PRESETS_KEY,
    queryFn: () => api.get<Preset[]>("/presets/"),
  });
}

export function useUploadPresets() {
  const queryClient = useQueryClient();
  return useMutation<Preset[], Error, File[]>({
    mutationFn: (files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      return api.upload<Preset[]>("/presets/upload", formData);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: PRESETS_KEY });
      toast.success(`${data.length} preset${data.length === 1 ? "" : "s"} uploaded`);
    },
    onError: () => {
      toast.error("Failed to upload presets");
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (name) => api.del(`/presets/${encodeURIComponent(name)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRESETS_KEY });
      toast.success("Preset deleted");
    },
    onError: () => {
      toast.error("Failed to delete preset");
    },
  });
}