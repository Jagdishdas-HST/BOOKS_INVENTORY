import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "vite-joylo-runtime-overlay";
import joyloEditor from "vite-plugin-joylo-editor";

export default defineConfig(({ isSsrBuild }) => ({
  // Joylo editor/overlay plugins are browser-only; including them in the SSR bundle breaks it.
  plugins: isSsrBuild
    ? [react(), tailwindcss()]
    : [joyloEditor(), runtimeErrorOverlay(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "frontend/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "frontend"),
  build: {
    outDir: isSsrBuild
      ? path.resolve(import.meta.dirname, "dist/server")
      : path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));
