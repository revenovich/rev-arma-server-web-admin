import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 9510,
    proxy: {
      "/api": {
        target: "http://localhost:9500",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:9500",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  base: "/",
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});