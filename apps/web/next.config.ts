import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@amdox/ui", "@amdox/types"],
  experimental: {
    optimizePackageImports: ["@amdox/ui"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
