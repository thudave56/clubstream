import { appendFileSync } from "node:fs";

const apiBase = process.env.RENDER_API_BASE ?? "https://api.render.com/v1";
const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;
const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL;
const sha = process.env.DEPLOY_SHA;

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      // If parsing fails, include raw text in error for debugging
      if (!response.ok) {
        throw new Error(`Request failed ${response.status}: ${text}`);
      }
      // For successful responses with non-JSON body (e.g., deploy hooks), return empty object
    }
  }
  
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function getLatestDeployId() {
  if (!serviceId || !apiKey) {
    return "";
  }

  const deploys = await requestJson(`${apiBase}/services/${serviceId}/deploys`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const list = Array.isArray(deploys) ? deploys : deploys?.deploys ?? [];
  return list[0]?.id ?? "";
}

async function triggerViaApi() {
  if (!apiKey || !serviceId) {
    return "";
  }

  const payload = sha ? { clearCache: "do_not_clear", commitId: sha } : { clearCache: "do_not_clear" };
  const result = await requestJson(`${apiBase}/services/${serviceId}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return result?.id ?? result?.deploy?.id ?? "";
}

async function triggerViaHook() {
  if (!hookUrl) {
    return "";
  }

  const result = await requestJson(hookUrl, { method: "POST" });
  return result?.id ?? result?.deploy?.id ?? result?.deployId ?? "";
}

function writeOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
}

async function main() {
  let deployId = "";

  if (apiKey && serviceId) {
    deployId = await triggerViaApi();
  } else if (hookUrl) {
    deployId = await triggerViaHook();
  }

  if (!deployId) {
    deployId = await getLatestDeployId();
  }

  if (!deployId) {
    throw new Error("Unable to determine Render deploy ID. Configure API key + service ID for reliable polling.");
  }

  writeOutput("deploy_id", deployId);
  console.log(deployId);
}

main().catch((error) => {
  console.error(`[deploy:trigger] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
