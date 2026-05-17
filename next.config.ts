import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancre la root du workspace ici (sinon Turbopack remonte jusqu'à un autre
  // package-lock.json plus haut dans l'arbo iCloud, cf. warning au build).
  // process.cwd() est universel (CJS + ESM, local + Vercel) ; __dirname
  // n'existe pas en ESM, ce qui plantait next.config.ts à l'exécution.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
