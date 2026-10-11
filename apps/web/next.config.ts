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
  async headers() {
    return [
      {
        // Public upload page. `default-src 'self'` means nothing loads from a
        // third party, and `img-src` allows only same-origin plus the blob:
        // URLs used for the local photo previews.
        source: "/contribute/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' blob: data:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // Ingestion endpoints return machine-readable codes and must never be
        // cached by the phone, a proxy, or Cloudflare.
        source: "/api/contribute/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
