import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the file-tracing root to this project so a stray lockfile in a parent
  // directory can't confuse the build (harmless locally, safe on Railway).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
