import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/auth": "http://localhost:3001",
      "/login": "http://localhost:3001",
      "/me": "http://localhost:3001",
      "/register": "http://localhost:3001",
      "/logout": "http://localhost:3001",
      "/health": "http://localhost:3001"
    }
  }
});
