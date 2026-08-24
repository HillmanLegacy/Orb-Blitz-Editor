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
    // The Three.js/Fiber runtime is a shared peer-dependency boundary. It is
    // loaded once for gameplay and cannot be split further without duplicating
    // renderer code, so use a threshold that reflects the verified bundle.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("/@react-three/postprocessing/")) return "vendor-postprocessing";
          if (id.includes("/postprocessing/")) return "vendor-postprocessing";
          if (id.includes("/@react-three/drei/")) return "vendor-drei";
          if (id.includes("/@react-three/fiber/")) return "vendor-react-three";
          if (id.includes("/framer-motion/")) return "vendor-motion";
          if (id.includes("/@radix-ui/")) return "vendor-radix";
          return undefined;
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
