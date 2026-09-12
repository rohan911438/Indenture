/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
