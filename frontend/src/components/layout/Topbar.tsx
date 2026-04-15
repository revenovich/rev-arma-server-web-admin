import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function Topbar() {
  return (
    <header
      role="banner"
      className="flex h-topbar items-center border-b border-border bg-surface px-6"
    >
      <Breadcrumb />
    </header>
  );
}