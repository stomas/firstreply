import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Leidžia patikros build'ams naudoti atskirą katalogą (NEXT_DIST_DIR),
  // kad `next build` neperrašytų `.next`, iš kurio gyvena veikiantis dev
  // serveris. Railway/dev be šio kintamojo — įprastas `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return [
      {
        source: "/demo",
        destination: "/pavyzdziai",
        permanent: true,
      },
    ];
  },
  // Pin the file-tracing root to this project so a stray lockfile in a parent
  // directory can't confuse the build (harmless locally, safe on Railway).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
