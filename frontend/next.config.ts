import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: "/marketplace",
        destination: "/dashboard/marketplace",
      },
      {
        source: "/rfqs",
        destination: "/dashboard/rfqs",
      },
      {
        source: "/orders",
        destination: "/dashboard/orders",
      },
      {
        source: "/delivery",
        destination: "/dashboard/delivery",
      },
      {
        source: "/profile",
        destination: "/dashboard/profile",
      },
      {
        source: "/admin",
        destination: "/dashboard/admin",
      },
    ];
  },
};

export default nextConfig;
