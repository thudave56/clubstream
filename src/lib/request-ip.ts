/**
 * Extract the "real" client IP for rate limiting purposes.
 *
 * Notes:
 * - In production, we trust common proxy headers.
 * - In non-production, Playwright/E2E can force a stable IP via `x-test-client-ip`
 *   to avoid flakiness caused by varying proxy/IP behavior in CI.
 */
export function getClientIp(request: { headers: Headers }): string {
  if (process.env.NODE_ENV !== "production") {
    const testIp = request.headers.get("x-test-client-ip");
    if (testIp) return testIp.trim();
  }

  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();

  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();

  return "unknown";
}

