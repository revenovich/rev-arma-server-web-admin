import { Menu } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header
      role="banner"
      className="flex h-topbar items-center border-b border-white/10 glass px-6"
    >
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="mr-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <Breadcrumb />
    </header>
  );
}