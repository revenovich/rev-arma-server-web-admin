import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { AnimatedOutlet } from "@/components/layout/AnimatedOutlet";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-content">
          <div className="mx-auto max-w-content">
            <AnimatedOutlet />
          </div>
        </main>
      </div>
    </div>
  );
}