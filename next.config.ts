import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false, // hides the dev badge so demo recordings stay clean
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    // Recovery/verification query strings can contain bearer tokens. Never print those URLs.
    incomingRequests: { ignore: [/\/(?:verify-email|reset-password)(?:[/?]|$)/] },
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        // Keep loader dependency contexts out of mutable databases and build output.
        loaders: [{ loader: "@tailwindcss/turbopack", options: { base: path.join(process.cwd(), "src") } }],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
