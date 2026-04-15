import { AnimatePresence, motion } from "framer-motion";
import { Server } from "lucide-react";
import { LogOut } from "lucide-react";
import { SidebarNav } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/features/auth/useAuth";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const { logout } = useAuth();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Sidebar panel */}
          <motion.aside
            initial={{ x: -192 }}
            animate={{ x: 0 }}
            exit={{ x: -192 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="glass fixed inset-y-0 left-0 z-50 flex w-48 flex-col border-r border-white/10 md:hidden"
          >
            <div className="flex h-topbar items-center gap-2.5 border-b border-white/10 px-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20">
                <Server className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="gradient-heading text-sm font-bold tracking-tight">
                Arma Admin
              </span>
            </div>

            <SidebarNav onNavigate={onClose} />

            <div className="border-t border-white/10 p-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-gray-500">v0.1.0</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      logout();
                      onClose();
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}