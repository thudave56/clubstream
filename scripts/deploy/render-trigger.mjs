import { appendFileSync } from "node:fs";

const apiBase = process.env.RENDER_API_BASE ?? "https://api.render.com/v1";
const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;
const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL;
const sha = process.env.DEPLOY_SHA;

async function requestJson(url, options = {}, isHookEndpoint = false) {
  const response = await fetch(url, options);
  const text = await response.text();
  
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      // Only swallow parse errors for successful hook endpoint responses
      if (!isHookEndpoint || !response.ok) {
        // For API endpoints or failed requests, include raw body in error
        if (!response.ok) {
          throw new Error(`Request failed ${response.status}: ${text}`);
        }
        // For successful API responses that aren't JSON, this is unexpected
        throw new Error(`Unexpected non-JSON response from ${url}: ${text.substring(0, 100)}`);
      }
      // Hook endpoints may return empty/non-JSON on success - allow it
    }
  }
  
  if (!response.ok) {
    // Include parsed JSON if available, otherwise raw text
    const errorDetail = Object.keys(json).length > 0 ? JSON.stringify(json) : text || 'No response body';
    throw new Error(`Request failed ${response.status}: ${errorDetail}`);
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

  const result = await requestJson(hookUrl, { method: "POST" }, true);
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
