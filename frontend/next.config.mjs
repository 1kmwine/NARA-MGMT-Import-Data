/** @type {import('next').NextConfig} */
// Reverted to root-serving (bare port :3001) — the hub source keeps
// hardcoding m11's externalUrl back to http://192.168.47.105:3001/ on every
// hub redeploy, so a basePath here just breaks the app. See project memory
// for the path-based attempt if this gets revisited.
const nextConfig = {};

export default nextConfig;
