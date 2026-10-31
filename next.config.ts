import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // hides the dev badge so demo recordings stay clean
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    // Recovery/verification query strings can contain bearer tokens. Never print those URLs.
    incomingRequests: { ignore: [/\/(?:verify-email|reset-password)(?:[/?]|$)/] },
  },
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
