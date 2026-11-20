import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  publicDir: "fleetorafreights.com",
  plugins: [react(), tailwindcss()],
});
