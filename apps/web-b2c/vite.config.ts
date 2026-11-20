import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { publicPageEntries } from "./publicPageEntries";

export default defineConfig(() => ({

  envDir: __dirname, // lee .env* de apps/web-b2c
  server: {
    host: true,
    port: 5174,
  },

  plugins: [react(), publicPageEntries()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
