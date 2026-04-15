import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusDot } from "@/components/servers/StatusDot";

describe("StatusDot", () => {
  it("renders online dot with breath animation", () => {
    const { container } = render(<StatusDot online={true} />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass("animate-status-breath");
    expect(dot).toHaveClass("bg-success");
    expect(dot).toHaveAttribute("aria-label", "Online");
  });

  it("renders offline dot without animation", () => {
    const { container } = render(<StatusDot online={false} />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).not.toHaveClass("animate-status-breath");
    expect(dot).toHaveClass("bg-muted-foreground/30");
    expect(dot).toHaveAttribute("aria-label", "Offline");
  });

  it("applies custom className", () => {
    const { container } = render(<StatusDot online={true} className="h-3 w-3" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass("h-3", "w-3");
  });
});