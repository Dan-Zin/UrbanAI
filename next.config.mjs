/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Small runtime image: `node server.js` instead of a full node_modules tree.
  output: "standalone",
};

export default nextConfig;
