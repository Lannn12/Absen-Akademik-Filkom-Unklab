import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimized for Vercel deployment
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
