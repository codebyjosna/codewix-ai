import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Amplify's SSR compute doesn't inject configured env vars into the
  // runtime process; bake them into the server bundle at build time instead
  // (build-time env access is confirmed working). Server-only, never
  // referenced from client components, so this never reaches the browser.
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
  outputFileTracingExcludes: {
    "*": [
      "**/node_modules/.pnpm/@braintrust+bt-darwin-*/**",
      "**/node_modules/.pnpm/@braintrust+bt-win32-*/**",
      "**/node_modules/.pnpm/@braintrust+bt-linux-arm64@*/**",
      "**/node_modules/.pnpm/@braintrust+bt-linux-x64-musl@*/**",
      "**/node_modules/.pnpm/@img+sharp-win32-*/**",
      "**/node_modules/.pnpm/@img+sharp-darwin-*/**",
      "**/node_modules/.pnpm/@img+sharp-linux-arm@*/**",
      "**/node_modules/.pnpm/@img+sharp-linux-arm64@*/**",
      "**/node_modules/.pnpm/@img+sharp-linux-ppc64@*/**",
      "**/node_modules/.pnpm/@img+sharp-linux-s390x@*/**",
      "**/node_modules/.pnpm/@img+sharp-linuxmusl-*/**",
      "**/node_modules/.pnpm/@img+sharp-wasm32@*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-darwin-*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-linux-arm@*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-linux-ppc64@*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-linux-s390x@*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-linux-riscv64@*/**",
      "**/node_modules/.pnpm/@img+sharp-libvips-linuxmusl-*/**",
      "**/node_modules/.pnpm/playwright@*/**",
      "**/node_modules/.pnpm/playwright-core@*/**",
      "**/node_modules/.pnpm/monaco-editor@*/**",
    ],
  },
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {},
  async headers() {
    return [
      {
        source: "/preview-vendor/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
      {
        source: "/preview-vendor-v2/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/preview-vendor-v2/:path*",
        destination: "/preview-vendor/:path*",
      },
    ];
  },
  webpack: (config, options) => {
    if (options.nextRuntime === "edge") {
      if (!config.resolve.conditionNames) {
        config.resolve.conditionNames = ["require", "node"];
      }
      if (!config.resolve.conditionNames.includes("worker")) {
        config.resolve.conditionNames.push("worker");
      }
    }
    return config;
  },
};

export default nextConfig;
