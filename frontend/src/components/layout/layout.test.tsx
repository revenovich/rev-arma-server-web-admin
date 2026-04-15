import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

function ShellWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<p>Test content area</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("AppShell", () => {
  it("renders sidebar and topbar", () => {
    render(<ShellWrapper />);

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders route content in the content area", () => {
    render(<ShellWrapper />);

    expect(screen.getByText("Test content area")).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  it("renders navigation links", () => {
    render(<Sidebar />, { wrapper: Wrapper });

    expect(screen.getByText("Servers")).toBeInTheDocument();
    expect(screen.getByText("Mods")).toBeInTheDocument();
    expect(screen.getByText("Missions")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("has correct nav link hrefs", () => {
    render(<Sidebar />, { wrapper: Wrapper });

    const links = screen.getByRole("navigation", { name: "Primary" }).querySelectorAll("a");
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/mods");
    expect(hrefs).toContain("/missions");
    expect(hrefs).toContain("/logs");
    expect(hrefs).toContain("/settings");
  });

  it("renders theme toggle in footer", () => {
    render(<Sidebar />, { wrapper: Wrapper });

    expect(
      screen.getByLabelText(/switch to/i),
    ).toBeInTheDocument();
  });
});

describe("Topbar", () => {
  it("renders as a banner", () => {
    render(<Topbar />, { wrapper: Wrapper });
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders breadcrumb area", () => {
    render(<Topbar />, { wrapper: Wrapper });
    // Breadcrumb nav should exist inside topbar
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});

describe("Breadcrumb", () => {
  it("renders breadcrumb navigation", () => {
    render(<Breadcrumb />, { wrapper: Wrapper });
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});