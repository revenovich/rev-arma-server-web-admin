import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Mod } from "@/types/api";

const MODS_KEY = ["mods"] as const;

export function useMods() {
  return useQuery<Mod[]>({
    queryKey: MODS_KEY,
    queryFn: () => api.get<Mod[]>("/mods/"),
  });
}