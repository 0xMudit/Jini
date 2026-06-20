import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/jini/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8788",
    },
  },
});
