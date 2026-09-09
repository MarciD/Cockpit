/**
 * Plain ESM rather than TypeScript on purpose: `next start` has to be able to
 * read this file, and a production container has no TypeScript compiler in it.
 *
 * @type {import("next").NextConfig}
 */
const nextConfig = {
  // Overridable so a dev/screenshot server can run next to the launchd
  // `next start` instance without both writing into the same `.next`.
  distDir: process.env.COCKPIT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  // No ESLint config in this repo by design; CI runs Prettier + tsc + build.
  eslint: { ignoreDuringBuilds: true },
  // Workspace packages ship TS source; let Next compile them.
  transpilePackages: [
    "@cockpit/widget-sdk",
    "@cockpit/widgets",
    "@cockpit/integrations",
    "@cockpit/db",
  ],
  serverExternalPackages: ["better-sqlite3", "node-ical", "fast-xml-parser"],
  // Defence in depth for a dashboard that holds live work data. No CSP: Chakra
  // v3 emits runtime styles, so a useful one needs a nonce pipeline the rest of
  // this app doesn't have. See SECURITY.md.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep the native SQLite addon out of the server bundle so its `.node`
      // binding resolves from node_modules at runtime (serverExternalPackages
      // isn't honored for a dep pulled in through a transpiled workspace pkg).
      const externals = config.externals ?? [];
      const extra = ["better-sqlite3", "node-ical", "fast-xml-parser"];
      config.externals = Array.isArray(externals)
        ? [...externals, ...extra]
        : [externals, ...extra];
    }
    return config;
  },
  // Deliberately not `output: "standalone"`. better-sqlite3 / node-ical /
  // fast-xml-parser are externals pulled in through transpiled workspace
  // packages, and Next's file tracing does not reliably carry the native
  // binding across pnpm's symlinked layout. The Docker image installs
  // production dependencies instead and runs `next start`.
};

export default nextConfig;
