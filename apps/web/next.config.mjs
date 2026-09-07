/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No API routes by design - the web app reads only from the mirror node + RPC.
  transpilePackages: ["@indenture/hedera", "@indenture/mandate", "@indenture/chainlink"],
};

export default nextConfig;
