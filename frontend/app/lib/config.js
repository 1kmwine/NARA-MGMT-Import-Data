// No basePath while served at the bare :3001 port (see next.config.mjs).
// Kept as a single source of truth in case path-based serving comes back.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
