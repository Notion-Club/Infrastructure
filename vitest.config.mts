import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config minimale : tests unitaires purs (logique de rendu), environnement node,
// pas de DOM. Les fichiers .tsx sont transformés en JSX runtime automatique par
// esbuild (pas besoin d'importer React dans les sources ni les tests).
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
