import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
    dedupe: ["react", "react-dom", "@react-three/fiber", "three"],
  },
  optimizeDeps: {
    include: ["@react-three/postprocessing", "postprocessing"],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
    port: parseInt(process.env.PORT || "3000"),
  },
  preview: {
    port: parseInt(process.env.PORT || "3000"),
    allowedHosts: true,
  },
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.fbx", "**/*.mp3", "**/*.ogg", "**/*.wav"],
});
