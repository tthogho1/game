import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build runnable from any static host (GitHub Pages, itch.io, etc.)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
