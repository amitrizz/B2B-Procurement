import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
      {
        source: "/admin_users",
        destination: "/dashboard/admin_users",
      },
      {
        source: "/catalog",
        destination: "/dashboard/catalog",
      },
      {
        source: "/prs",
        destination: "/dashboard/prs",
      },
      {
        source: "/chat",
        destination: "/dashboard/chat",
      },
    ];
  },
};

export default nextConfig;
