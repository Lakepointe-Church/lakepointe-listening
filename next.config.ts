import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal brand-monitoring dashboard — keep it out of search indexes.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
