import { type RouteObject } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { OverviewScreen } from "@/features/servers/OverviewScreen";
import { ServerDetailScreen } from "@/features/servers/ServerDetailScreen";
import { InfoTab } from "@/features/servers/tabs/InfoTab";
import { MissionsTab } from "@/features/servers/tabs/MissionsTab";
import { ModsTab } from "@/features/servers/tabs/ModsTab";
import { DifficultyTab } from "@/features/servers/tabs/DifficultyTab";
import { NetworkTab } from "@/features/servers/tabs/NetworkTab";
import { SecurityTab } from "@/features/servers/tabs/SecurityTab";
import { AdvancedTab } from "@/features/servers/tabs/AdvancedTab";
import { HeadlessTab } from "@/features/servers/tabs/HeadlessTab";
import { ModsScreen } from "@/features/mods/ModsScreen";
import { MissionsScreen } from "@/features/missions/MissionsScreen";
import { LogsScreen } from "@/features/logs/LogsScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { SteamCmdScreen } from "@/features/steamcmd/SteamCmdScreen";
import { PresetsScreen } from "@/features/presets/PresetsScreen";

// eslint-disable-next-line react-refresh/only-export-components
function PresetDetailScreen() {
  return (
    <h1 className="text-2xl font-bold tracking-tight gradient-heading">
      Preset Detail
    </h1>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function NotFoundScreen() {
  return (
    <h1 className="text-2xl font-bold tracking-tight gradient-heading">
      Not Found
    </h1>
  );
}

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewScreen /> },
      {
        path: "/servers/:id",
        element: <ServerDetailScreen />,
        children: [
          { index: true, element: <InfoTab /> },
          { path: "info", element: <InfoTab /> },
          { path: "missions", element: <MissionsTab /> },
          { path: "mods", element: <ModsTab /> },
          { path: "difficulty", element: <DifficultyTab /> },
          { path: "network", element: <NetworkTab /> },
          { path: "security", element: <SecurityTab /> },
          { path: "advanced", element: <AdvancedTab /> },
          { path: "headless", element: <HeadlessTab /> },
        ],
      },
      { path: "/mods", element: <ModsScreen /> },
      { path: "/missions", element: <MissionsScreen /> },
      { path: "/logs", element: <LogsScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "/steamcmd", element: <SteamCmdScreen /> },
      { path: "/presets", element: <PresetsScreen /> },
      { path: "/presets/:id", element: <PresetDetailScreen /> },
      { path: "*", element: <NotFoundScreen /> },
    ],
  },
];