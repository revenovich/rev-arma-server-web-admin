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
import { motion } from "framer-motion";
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

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const location = useLocation();
  const { data: servers } = useServers();

  return (
    <>
      <nav aria-label="Primary" className="space-y-1 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href);

          return (
            <motion.div
              key={item.href}
              whileHover={{ x: 6 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Link
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                  isActive
                    ? "bg-indigo-500/20 font-medium text-indigo-100 ring-1 ring-inset ring-indigo-400/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                    : "text-gray-300 hover:bg-white/5 hover:text-white",
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-indigo-400" />
                )}
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {servers && servers.length > 0 && (
        <div className="flex-1 overflow-y-auto border-t border-white/10 px-2 py-2">
          <p className="section-label mb-2 px-3">Servers</p>
          <ul className="space-y-0.5" role="list">
            {servers.map((server) => {
              const online = server.state?.online ?? false;
              const isActive = location.pathname.startsWith(`/servers/${server.id}`);
              return (
                <li key={server.id}>
                  <Link
                    to={`/servers/${server.id}/info`}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-200",
                      isActive
                        ? "bg-indigo-500/20 font-medium text-indigo-100 ring-1 ring-inset ring-indigo-400/30"
                        : "text-gray-400 hover:bg-white/5 hover:text-white",
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
    </>
  );
}

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="glass hidden md:flex h-screen w-sidebar flex-col border-r border-white/10">
      <div className="flex h-topbar items-center gap-2.5 border-b border-white/10 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20">
          <Server className="h-4 w-4 text-indigo-400" />
        </div>
        <span className="gradient-heading text-sm font-bold tracking-tight">
          Arma Admin
        </span>
      </div>

      <SidebarNav />

      <div className="border-t border-white/10 p-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-gray-500">v0.1.0</span>
          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
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