import { readFileSync } from "node:fs";

const apiBase = process.env.RENDER_API_BASE ?? "https://api.render.com/v1";
const apiKey = process.env.RENDER_API_KEY;
const ownerId = process.env.RENDER_OWNER_ID;
const blueprintPath = process.env.RENDER_BLUEPRINT_PATH ?? "render.yaml";

function fail(message) {
  console.error(`[render:validate-blueprint] ${message}`);
  process.exit(1);
}

async function main() {
  if (!apiKey) fail("RENDER_API_KEY is required.");
  if (!ownerId) fail("RENDER_OWNER_ID is required (workspace ID like 'tea-...').");

  const content = readFileSync(blueprintPath, "utf8");
  if (!content.trim()) fail(`${blueprintPath} is empty.`);

  const form = new FormData();
  form.set("ownerId", ownerId);
  // Avoid relying on the global File constructor (not always present across Node versions).
  form.set(
    "file",
    new Blob([content], { type: "application/x-yaml" }),
    "render.yaml"
  );

  const res = await fetch(`${apiBase}/blueprints/validate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    fail(`HTTP ${res.status}: ${json ? JSON.stringify(json) : text || "no response body"}`);
  }

  if (!json || typeof json !== "object") {
    fail("Unexpected empty response from Render validate endpoint.");
  }

  if (json.valid !== true) {
    console.error("[render:validate-blueprint] Blueprint is NOT valid.");
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      for (const err of json.errors) {
        const loc =
          err && typeof err === "object" && "line" in err && "column" in err
            ? ` (line ${err.line}, col ${err.column})`
            : "";
        console.error(`- ${err.path ?? "unknown"}: ${err.error ?? "unknown error"}${loc}`);
      }
    }
    process.exit(1);
  }

  console.log("[render:validate-blueprint] Blueprint validated successfully.");
  if (json.plan) {
    const services = Array.isArray(json.plan.services) ? json.plan.services : [];
    const databases = Array.isArray(json.plan.databases) ? json.plan.databases : [];
    console.log(`[render:validate-blueprint] Plan: services=${services.length}, databases=${databases.length}`);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
