// basePath the app is served under. next/link and next/router prefix this
// automatically, but a raw same-origin fetch() (e.g. the /api/insights route)
// does NOT — prefix those manually with BASE_PATH. Keep in sync with
// next.config.mjs basePath and the nginx location.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/NID/import-data";
