import { Link, useLocation } from "react-router-dom";
import {
  Server,
  Package,
  Map,
  FileText,
  Settings,
  Download,
  FolderGit2,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { StatusDot } from "@/components/servers/StatusDot";
import { useServers } from "@/hooks/useServers";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Servers", href: "/", icon: Server },
  { label: "Mods", href: "/mods", icon: Package },
  { label: "Missions", href: "/missions", icon: Map },
  { label: "Logs", href: "/logs", icon: FileText },
  { label: "Presets", href: "/presets", icon: FolderGit2 },
  { label: "SteamCMD", href: "/steamcmd", icon: Download },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { data: servers } = useServers();
  const { logout } = useAuth();

  return (
    <aside className="flex h-screen w-sidebar flex-col border-r border-border bg-sidebar">
      <div className="flex h-topbar items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/20">
          <Server className="h-4 w-4 text-accent" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Arma Admin</span>
      </div>

      <nav aria-label="Primary" className="space-y-1 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent/20 text-accent font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {servers && servers.length > 0 && (
        <div className="flex-1 overflow-y-auto border-t border-sidebar-border px-2 py-2">
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
            Servers
          </p>
          <ul className="space-y-0.5" role="list">
            {servers.map((server) => {
              const online = server.state?.online ?? false;
              const isActive = location.pathname.startsWith(`/servers/${server.id}`);
              return (
                <li key={server.id}>
                  <Link
                    to={`/servers/${server.id}/info`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent/20 text-accent font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <StatusDot online={online} className="h-2 w-2 shrink-0" />
                    <span className="truncate">{server.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-sidebar-foreground/60">v0.1.0</span>
          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}