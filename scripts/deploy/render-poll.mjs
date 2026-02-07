import { appendFileSync } from "node:fs";

const apiBase = process.env.RENDER_API_BASE ?? "https://api.render.com/v1";
const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;
const timeoutSeconds = Number(process.env.RENDER_POLL_TIMEOUT_SECONDS ?? "900");
const intervalSeconds = Number(process.env.RENDER_POLL_INTERVAL_SECONDS ?? "10");

const SUCCESS_STATES = new Set(["live", "deployed", "active", "succeeded", "success"]);
const FAILURE_STATES = new Set(["failed", "build_failed", "canceled", "cancelled", "error", "timed_out"]);
const PENDING_STATES = new Set([
  "created",
  "queued",
  "pending",
  "in_progress",
  "running",
  "build_in_progress",
  "update_in_progress"
]);

function writeOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function resolveDeployId(initialDeployId) {
  if (initialDeployId) {
    return initialDeployId;
  }

  const deploys = await requestJson(`${apiBase}/services/${serviceId}/deploys`);
  const list = Array.isArray(deploys) ? deploys : deploys?.deploys ?? [];
  return list[0]?.id ?? "";
}

function getStatus(payload) {
  return payload?.status ?? payload?.deploy?.status ?? "unknown";
}

async function main() {
  if (!apiKey || !serviceId) {
    throw new Error("RENDER_API_KEY and RENDER_SERVICE_ID are required for polling.");
  }

  const deployId = await resolveDeployId(process.env.RENDER_DEPLOY_ID ?? "");
  if (!deployId) {
    throw new Error("Unable to determine deploy ID for polling.");
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastStatus = "unknown";

  while (Date.now() < deadline) {
    const payload = await requestJson(`${apiBase}/services/${serviceId}/deploys/${deployId}`);
    const status = String(getStatus(payload)).toLowerCase();
    if (status !== lastStatus) {
      console.log(`[deploy:poll] deploy=${deployId} status=${status}`);
      lastStatus = status;
    }

    if (SUCCESS_STATES.has(status)) {
      writeOutput("deploy_id", deployId);
      writeOutput("deploy_status", status);
      return;
    }

    if (FAILURE_STATES.has(status)) {
      throw new Error(`Deploy ${deployId} failed with status '${status}'.`);
    }

    if (!PENDING_STATES.has(status)) {
      console.log(`[deploy:poll] waiting on unrecognized status '${status}'`);
    }

    await sleep(intervalSeconds * 1000);
  }

  throw new Error(`Timed out after ${timeoutSeconds}s waiting for deploy ${deployId}. Last status: ${lastStatus}`);
}

main().catch((error) => {
  console.error(`[deploy:poll] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
