import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mosaic is normally reached over a tunnel or a LAN address rather than
  // localhost, so dev assets have to be served to those hosts too.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.local"],
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
