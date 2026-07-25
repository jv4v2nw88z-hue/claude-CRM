import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy in dev so the session cookie is same-origin and just works.
    proxy: {
      // 8787 is `wrangler dev`'s default port. In production this proxy is not
      // involved at all — the Worker serves this build and the API together.
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
