import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancre la root du workspace ici (sinon Turbopack remonte jusqu'à un autre
  // package-lock.json plus haut dans l'arbo iCloud, cf. warning au build).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
