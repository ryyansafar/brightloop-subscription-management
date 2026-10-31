import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // hides the dev badge so demo recordings stay clean
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
