/**
 * API types matching the FastAPI backend.
 * Manually maintained until `npm run gen:types` is run with a live backend.
 */

// ─── Server ────────────────────────────────────────────────────────────────

export interface Server {
  id: string;
  title: string;
  port: number;
  password: string | null;
  admin_password: string | null;
  allowed_file_patching: number | null;
  auto_start: boolean;
  battle_eye: boolean;
  file_patching: boolean;
  forcedDifficulty: string | null;
  max_players: number;
  missions: unknown[];
  mods: string[];
  motd: string | null;
  number_of_headless_clients: number;
  parameters: string[];
  persistent: boolean;
  von: boolean;
  verify_signatures: number;
  additionalConfigurationOptions: string | null;
  // Runtime fields
  pid: number | null;
  state: ServerState | null;
}

export interface ServerState {
  online: boolean;
  players: number;
  maxPlayers: number;
  mission: string | null;
  map: string | null;
}

export interface ServerCreatePayload {
  title: string;
  port?: number;
  password?: string | null;
  admin_password?: string | null;
  allowed_file_patching?: number | null;
  auto_start?: boolean;
  battle_eye?: boolean;
  file_patching?: boolean;
  forcedDifficulty?: string | null;
  max_players?: number;
  missions?: unknown[];
  mods?: string[];
  motd?: string | null;
  number_of_headless_clients?: number;
  parameters?: string[];
  persistent?: boolean;
  von?: boolean;
  verify_signatures?: number;
  additionalConfigurationOptions?: string | null;
  // Config-level fields (written to server.cfg, not servers.json)
  autoSelectMission?: boolean;
  randomMissionOrder?: boolean;
  // Network config fields (written to basic.cfg)
  MaxMsgSend?: number;
  MaxSizeGuaranteed?: number;
  MaxSizeNonguaranteed?: number;
  MinBandwidth?: number;
  MaxBandwidth?: number;
  MinPacketSize?: number;
  MaxPacketSize?: number;
  MaxPing?: number;
  MaxPacketLoss?: number;
  MaxDesync?: number;
  DisconnectTimeout?: number;
  kickDuplicate?: number;
  loopback?: number;
  upnp?: number;
  // Security config fields
  filePatchingExceptions?: string[];
  allowedLoadFileExtensions?: string[];
  serverCommandPassword?: string | null;
}

export type ServerUpdatePayload = Partial<ServerCreatePayload>;

// ─── Mod ────────────────────────────────────────────────────────────────────

export interface Mod {
  name: string;
  size: number;
  formattedSize: string;
  modFile: unknown | null;
  steamMeta: unknown | null;
}

// ─── Mission ────────────────────────────────────────────────────────────────

export interface Mission {
  name: string;          // full filename e.g. "co_10_escape.malden.pbo"
  missionName: string;   // e.g. "co_10_escape"
  worldName: string;     // e.g. "malden"
  size: number;
  sizeFormatted: string;
  dateCreated: string;
  dateModified: string;
}

// ─── Log ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  created: string;
  modified: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface Settings {
  [key: string]: unknown;
}

// ─── SteamCMD ───────────────────────────────────────────────────────────────

export interface SteamCmdVersion {
  version: string | null;
  installed: boolean;
}

export interface SteamCmdBranch {
  branch: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface ServerConfig {
  hostname: string;
  password: string | null;
  passwordAdmin: string | null;
  maxPlayers: number;
  motd: string[];
  motdInterval: number;
  headlessClients: string[];
  localClient: string[];
  admins: string[];
  verifySignatures: number;
  allowedFilePatching: number;
  filePatchingExceptions: string[];
  allowedLoadFileExtensions: string[];
  kickDuplicate: number;
  loopback: number;
  upnp: number;
  vonCodec: number;
  vonCodecQuality: number;
  disableVoN: number;
  persistent: boolean;
  battleEye: boolean;
  voteThreshold: number;
  voteMissionPlayers: number;
  kickTimeout: number[][];
  votingTimeOut: number[];
  roleTimeOut: number[];
  briefingTimeOut: number[];
  debriefingTimeOut: number[];
  lobbyIdleTimeout: number;
  MaxPing: number;
  MaxPacketLoss: number;
  MaxDesync: number;
  DisconnectTimeout: number;
  kickClientsOnSlowNetwork: number[];
  serverCommandPassword: string | null;
  missions: unknown[];
  additionalConfigurationOptions: string;
  forcedDifficulty: string | null;
  difficultyOptions: Record<string, unknown>;
  // basic.cfg fields
  MaxMsgSend: number;
  MaxSizeGuaranteed: number;
  MaxSizeNonguaranteed: number;
  MinBandwidth: number;
  MaxBandwidth: number;
  MinPacketSize: number;
  MaxPacketSize: number;
  sockets: {
    maxPacketSize: number;
  };
}

// ─── Preset ─────────────────────────────────────────────────────────────────

export interface Preset {
  preset_name: string;
  source_file: string;
  mod_count: number;
  mods: PresetMod[];
}

export interface PresetMod {
  name: string;
  source: string;
  url: string | null;
  steam_id: string | null;
}

export interface Comparison {
  shared: PresetMod[];
  uniqueToA: PresetMod[];
  uniqueToB: PresetMod[];
}

export interface LinkStatus {
  name: string;
  steamId: string | null;
  linked: boolean;
  group: string;
  path: string | null;
}

export interface MissingReport {
  name: string;
  steamId: string | null;
  group: string;
  status: string;
}

export interface NameCheckResult {
  name: string;
  steamId: string | null;
  matchLevel: string;
  suggestedFix: string | null;
}

// ─── WebSocket ─────────────────────────────────────────────────────────────

export interface WsEvent {
  type: string;
  serverId: string | null;
  payload: unknown;
}