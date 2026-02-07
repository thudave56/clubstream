import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function read(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

const date = read("REHEARSAL_DATE", new Date().toISOString().slice(0, 10));
const commit = read("REHEARSAL_COMMIT", read("GITHUB_SHA", "unknown"));
const ciRunUrl = read("REHEARSAL_CI_RUN_URL");
const stagingRunUrl = read("REHEARSAL_STAGING_RUN_URL");
const productionRunUrl = read("REHEARSAL_PRODUCTION_RUN_URL");
const rollbackRunUrl = read("REHEARSAL_ROLLBACK_RUN_URL");
const outcome = read("REHEARSAL_OUTCOME");
const notes = read("REHEARSAL_NOTES", "N/A");
const outputPath = read("REHEARSAL_OUTPUT_PATH", `docs/rehearsals/${date}.md`);

const missing = [];
if (!ciRunUrl) missing.push("REHEARSAL_CI_RUN_URL");
if (!stagingRunUrl) missing.push("REHEARSAL_STAGING_RUN_URL");
if (!outcome) missing.push("REHEARSAL_OUTCOME");

if (missing.length > 0) {
  console.error(
    `[deploy:record-rehearsal] Missing required env vars: ${missing.join(", ")}`
  );
  process.exit(1);
}

const content = `# Rehearsal Evidence: ${date}

## Summary
- Date: ${date}
- Commit: \`${commit}\`
- Outcome: ${outcome}

## Run Links
- CI: ${ciRunUrl}
- Staging Deploy: ${stagingRunUrl}
- Production Deploy: ${productionRunUrl || "N/A"}
- Rollback Drill: ${rollbackRunUrl || "N/A"}

## Notes
${notes}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content, "utf8");

console.log(`[deploy:record-rehearsal] Wrote ${outputPath}`);
