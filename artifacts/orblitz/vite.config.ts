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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep peer-dependent rendering packages together. This creates a
          // one-way dependency on React rather than splitting related Three
          // modules across chunks (which can produce circular chunk warnings).
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (
            id.includes("/three/") ||
            id.includes("/@react-three/") ||
            id.includes("/postprocessing/")
          ) {
            return "vendor-three";
          }
          if (id.includes("/framer-motion/")) return "vendor-motion";
          if (id.includes("/@radix-ui/")) return "vendor-radix";
        },
      },
    },
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
