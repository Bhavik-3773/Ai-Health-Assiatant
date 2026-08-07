/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained .next/standalone build (server.js +
  // only the node_modules actually used) — much smaller and more reliable
  // to copy into the final Docker stage than the full node_modules tree.
  output: "standalone",
};

module.exports = nextConfig;
