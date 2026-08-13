/** @type {import('next').NextConfig} */
// Served behind the NID hub's nginx at /NID/import-data (path-based, not a bare
// port). basePath is build-time inlined; keep it in sync with the nginx location
// and the BASE_PATH used for same-origin fetches (app/lib/config.js).
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "/NID/import-data",
};

export default nextConfig;
