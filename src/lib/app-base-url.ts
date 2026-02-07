const DEFAULT_DEV_BASE_URL = "http://localhost:3000";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Returns the externally reachable base URL for the app.
 *
 * Priority:
 * - APP_BASE_URL (explicit, supports custom domains)
 * - RENDER_EXTERNAL_URL (automatic on Render)
 * - localhost (dev fallback)
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    DEFAULT_DEV_BASE_URL;
  return stripTrailingSlashes(raw);
}

