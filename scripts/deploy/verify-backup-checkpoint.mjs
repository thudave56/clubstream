import { appendFileSync } from "node:fs";

const environment = String(process.env.DEPLOY_ENVIRONMENT ?? "").toLowerCase();
const checkpoint = String(process.env.DEPLOY_BACKUP_CHECKPOINT ?? "").trim();

function writeOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
}

function writeSummary(line) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    appendFileSync(summaryFile, `${line}\n`);
  }
}

if (environment !== "production") {
  console.log(
    `[deploy:verify-backup] Skipping backup checkpoint validation for environment '${environment || "unknown"}'.`
  );
  process.exit(0);
}

if (!checkpoint) {
  console.error(
    "[deploy:verify-backup] DEPLOY_BACKUP_CHECKPOINT is required for production deploys."
  );
  process.exit(1);
}

if (checkpoint.length < 8) {
  console.error(
    "[deploy:verify-backup] DEPLOY_BACKUP_CHECKPOINT appears invalid (expected length >= 8)."
  );
  process.exit(1);
}

writeOutput("backup_checkpoint", checkpoint);
writeSummary(`- Backup checkpoint: \`${checkpoint}\``);
console.log(
  `[deploy:verify-backup] Using production backup checkpoint '${checkpoint}'.`
);
