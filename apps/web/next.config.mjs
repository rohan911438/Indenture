/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * `next dev` and `next build` write incompatible artefacts into the same
   * directory, so running a build while a dev server is up leaves that server
   * requiring chunk ids the build has just replaced — it dies on a missing
   * ./NNN.js and no amount of reloading fixes it.
   *
   * Setting NEXT_DIST_DIR sends a build somewhere else, so production builds,
   * Lighthouse runs and screenshots can happen against a live dev server
   * without touching it.
   *
   *   NEXT_DIST_DIR=.next-qa npx next build && NEXT_DIST_DIR=.next-qa npx next start
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No API routes by design - the web app reads only from the mirror node + RPC.
  transpilePackages: [
    "@indenture/hedera",
    "@indenture/mandate",
    "@indenture/chainlink",
    // ogl ships untranspiled ESM from src/ — the hero seal imports it directly.
    "ogl",
  ],
};

export default nextConfig;
