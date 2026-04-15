import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const LABEL_MAP: Record<string, string> = {
  "": "Servers",
  servers: "Server",
  mods: "Mods",
  missions: "Missions",
  logs: "Logs",
  settings: "Settings",
  steamcmd: "SteamCMD",
  presets: "Presets",
};

export function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const label = LABEL_MAP[seg] ?? seg;
    const isLast = i === segments.length - 1;
    return { label, isLast };
  });

  if (crumbs.length === 0) {
    crumbs.push({ label: "Servers", isLast: true });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-text-muted" />}
          <span
            className={
              crumb.isLast
                ? "text-text"
                : "text-text-muted"
            }
          >
            {crumb.label}
          </span>
        </span>
      ))}
    </nav>
  );
}