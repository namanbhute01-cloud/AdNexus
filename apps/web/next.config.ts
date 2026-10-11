import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@vaart/database", "@vaart/storage"],
  allowedDevOrigins: ["192.168.29.82"],
  turbopack: {
    // Pin the Turbopack root to the monorepo root so the linked @vaart/database
    // package resolves. Without this, Next infers the workspace root from any
    // lockfile above apps/web and can pick an unrelated one (e.g. ~/package-lock.json).
    root: path.join(__dirname, "../.."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "*",
      },
      {
        protocol: "https",
        hostname: "*",
      },
    ],
  },
};

export default nextConfig;
