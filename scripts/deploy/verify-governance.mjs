const DEFAULT_REQUIRED_CHECKS = ["test", "build", "e2e", "regression", "release-gate"];

function read(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function parseRequiredChecks(raw) {
  if (!raw) return DEFAULT_REQUIRED_CHECKS;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const token = read("GITHUB_TOKEN");
const repository = read("GITHUB_REPOSITORY");
const branch = read("GOVERNANCE_BRANCH", "main");
const requiredChecks = parseRequiredChecks(read("GOVERNANCE_REQUIRED_CHECKS"));
const requireProductionReviewers = read("GOVERNANCE_REQUIRE_PRODUCTION_REVIEWERS", "true") !== "false";

if (!token) {
  console.error("[deploy:verify-governance] Missing GITHUB_TOKEN.");
  process.exit(1);
}

if (!repository || !repository.includes("/")) {
  console.error(
    "[deploy:verify-governance] Missing or invalid GITHUB_REPOSITORY (expected owner/repo)."
  );
  process.exit(1);
}

const [owner, repo] = repository.split("/", 2);
const failures = [];
const infos = [];

async function githubRequest(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof data?.message === "string" ? data.message : `GitHub API request failed (${response.status}).`;
    throw new Error(`${message} (path=${path}, status=${response.status})`);
  }

  return data;
}

async function verifyBranchProtection() {
  const protection = await githubRequest(
    `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`
  );

  const contexts = protection?.required_status_checks?.contexts ?? [];
  const missingChecks = requiredChecks.filter((check) => !contexts.includes(check));

  infos.push(
    `[branch-protection] required status checks on ${branch}: ${contexts.length > 0 ? contexts.join(", ") : "none"}`
  );

  if (missingChecks.length > 0) {
    failures.push(
      `[branch-protection] missing required checks on ${branch}: ${missingChecks.join(", ")}`
    );
  }

  if (!protection?.required_pull_request_reviews) {
    failures.push(`[branch-protection] pull request reviews are not required on ${branch}.`);
  }

  if (!protection?.enforce_admins?.enabled) {
    failures.push(`[branch-protection] admin enforcement is disabled on ${branch}.`);
  }
}

async function verifyProductionEnvironment() {
  const environment = await githubRequest(`/repos/${owner}/${repo}/environments/production`);
  const protectionRules = environment?.protection_rules ?? [];
  const reviewerRule = protectionRules.find((rule) => rule?.type === "required_reviewers");
  const reviewerCount = reviewerRule?.reviewers?.length ?? 0;

  infos.push(
    `[environment] production protection rules: ${
      protectionRules.length > 0 ? protectionRules.map((rule) => rule.type).join(", ") : "none"
    }`
  );

  if (requireProductionReviewers && reviewerCount < 1) {
    failures.push("[environment] production environment must require at least one reviewer.");
  }
}

async function verifyStagingEnvironmentExists() {
  await githubRequest(`/repos/${owner}/${repo}/environments/staging`);
  infos.push("[environment] staging environment exists.");
}

try {
  await verifyBranchProtection();
  await verifyProductionEnvironment();
  await verifyStagingEnvironmentExists();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

for (const info of infos) {
  console.log(`[deploy:verify-governance] ${info}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[deploy:verify-governance] ${failure}`);
  }
  process.exit(1);
}

console.log("[deploy:verify-governance] Governance policy checks passed.");
