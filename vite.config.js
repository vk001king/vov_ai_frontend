import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The original project had no vite.config.js at all, so @vitejs/plugin-react
// was installed but never applied: no Fast Refresh, no dev proxy.
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    open: true,

    // Lets the frontend call "/api/..." with no CORS involvement.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
