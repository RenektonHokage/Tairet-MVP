import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  // Source of truth de envs para B2C: apps/web-b2c/.env*
  envDir: path.resolve(__dirname),

  server: {
    host: true,
    port: 5174,
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
