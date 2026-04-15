import { cn } from "@/lib/utils";

interface StatusDotProps {
  online: boolean;
  className?: string;
}

export function StatusDot({ online, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        online ? "bg-success animate-status-breath" : "bg-muted-foreground/30",
        className,
      )}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}