const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return fallback;
}

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const status = readArg("--status", process.env.DEPLOY_STATUS ?? "unknown");
const environment = readArg("--environment", process.env.DEPLOY_ENVIRONMENT ?? "unknown");
const sha = readArg("--sha", process.env.DEPLOY_SHA ?? process.env.GITHUB_SHA ?? "unknown");
const actor = process.env.GITHUB_ACTOR ?? "unknown";
const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "unavailable";

if (!webhookUrl) {
  console.log("[deploy:notify] DISCORD_WEBHOOK_URL not set, skipping notification.");
  process.exit(0);
}

const colors = {
  started: 0x3498db,
  success: 0x2ecc71,
  failure: 0xe74c3c
};

const color = colors[status] ?? 0x95a5a6;
const content = {
  embeds: [
    {
      title: `Deploy ${status.toUpperCase()} - ${environment}`,
      color,
      fields: [
        { name: "Environment", value: environment, inline: true },
        { name: "Actor", value: actor, inline: true },
        { name: "Commit", value: `\`${sha.slice(0, 12)}\``, inline: false },
        { name: "Workflow Run", value: runUrl, inline: false }
      ],
      timestamp: new Date().toISOString()
    }
  ]
};

async function main() {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed ${response.status}: ${body}`);
  }

  console.log(`[deploy:notify] Sent ${status} notification.`);
}

main().catch((error) => {
  console.error(`[deploy:notify] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
