#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "README.md",
  "LICENSE",
  "package.json",
  "fixtures/scenario.passing.json",
  "fixtures/scenario.degraded.json",
  "fixtures/sla-policy.json",
  "docs/setup.md",
  "docs/utm-links.md",
  "docs/publish-checklist.md",
  ".github/ISSUE_TEMPLATE/drill-fixture-request.md",
  ".github/ISSUE_TEMPLATE/runbook-improvement.md",
  ".github/workflows/check.yml"
];

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /password\s*[:=]\s*["'][^"']+["']/i,
  /official\s+partner/i,
  /guaranteed\s+(uptime|traffic|customers|savings|speed)/i,
  /unlimited\s+(tokens|requests|usage)/i,
  /cheapest/i
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`missing required file: ${file}`);
  }
}

for (const file of walk(root)) {
  if (file.includes(`${path.sep}.git${path.sep}`) || file.includes(`${path.sep}node_modules${path.sep}`)) continue;
  const relative = path.relative(root, file);
  if (relative === "scripts\\readiness.js" || relative === "scripts/readiness.js") continue;
  const body = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(body)) failures.push(`risky pattern ${pattern} in ${relative}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.private !== false) failures.push("package.json private must be false");
if (!packageJson.license) failures.push("package.json license is missing");

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes("https://www.tken.shop/")) failures.push("README missing tken.shop CTA");
if (!readme.includes("Disclosure: I work on TKEN-related developer tooling.")) failures.push("README missing disclosure");
if (!readme.includes("independent and non-official")) failures.push("README missing independence disclaimer");

if (failures.length) {
  console.error("Readiness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Readiness check passed.");

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
