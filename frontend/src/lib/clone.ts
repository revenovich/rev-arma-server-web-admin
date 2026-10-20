import type { Server, ServerCreatePayload } from "@/types/api";

/**
 * Create payload for a copy of *server*: a title no other server has, and no
 * port, so the backend picks a free one instead of clashing with the original.
 */
export function clonePayload(server: Server, existing: readonly Server[] = []): ServerCreatePayload {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, pid, state, port, ...rest } = server;
  const taken = new Set(existing.map((s) => s.title.toLowerCase()));
  let title = `Copy of ${server.title}`;
  for (let n = 2; taken.has(title.toLowerCase()); n++) {
    title = `Copy of ${server.title} (${n})`;
  }
  return { ...rest, title };
}
