const baseUrl = process.env.APP_BASE_URL;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "20000");
const paths = (process.env.SMOKE_PATHS ?? "/,/admin,/api/health")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

if (!baseUrl) {
  console.error("[deploy:smoke] APP_BASE_URL is required.");
  process.exit(1);
}

function joinUrl(root, path) {
  const trimmedRoot = root.endsWith("/") ? root.slice(0, -1) : root;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedRoot}${normalizedPath}`;
}

async function checkEndpoint(path) {
  const url = joinUrl(baseUrl, path);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Endpoint ${path} returned ${response.status}`);
  }

  if (path === "/api/health") {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Health endpoint did not return valid JSON.");
    }
    if (!payload || typeof payload !== "object" || payload.ok !== true) {
      throw new Error("Health endpoint did not return ok=true.");
    }
  }

  console.log(`[deploy:smoke] ${path} OK (${response.status})`);
}

async function main() {
  for (const path of paths) {
    await checkEndpoint(path);
  }
  console.log("[deploy:smoke] Smoke test passed.");
}

main().catch((error) => {
  console.error(`[deploy:smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
