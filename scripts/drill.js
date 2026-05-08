#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const scenarioPath = args.scenario ?? "fixtures/scenario.degraded.json";
const policyPath = args.policy ?? "fixtures/sla-policy.json";
const format = args.format ?? "text";

const scenario = readJson(scenarioPath);
const policy = readJson(policyPath);
const report = buildReport({ scenario, policy });

if (format === "json") {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderText(report));
}

process.exitCode = report.blocking.length > 0 ? 1 : 0;

function parseArgs(raw) {
  const parsed = {};
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = raw[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    console.error(`Failed to read JSON: ${resolved}`);
    console.error(error.message);
    process.exit(1);
  }
}

function buildReport({ scenario, policy }) {
  const blocking = [];
  const warnings = [];
  const passed = [];
  const routeChecks = [];
  const capabilityChecks = [];
  const metricChecks = [];
  const readinessChecks = [];

  for (const route of policy.requiredRoutes ?? []) {
    const ok = Boolean(scenario.routeHealth?.[route]);
    const check = {
      name: `required route healthy: ${route}`,
      ok,
      observed: ok ? "healthy" : "missing-or-degraded"
    };
    routeChecks.push(check);
    pushCheck({ check, blocking, passed });
  }

  for (const capability of policy.requiredCapabilities ?? []) {
    const ok = Boolean(scenario.capabilities?.[capability]);
    const check = {
      name: `required capability available: ${capability}`,
      ok,
      observed: ok ? "available" : "unavailable"
    };
    capabilityChecks.push(check);
    pushCheck({ check, blocking, passed });
  }

  const latencyBudget = policy.latencyBudgetMs ?? {};
  addMetricCheck({
    metricChecks,
    blocking,
    passed,
    name: "p95 latency within budget",
    observed: scenario.metrics?.p95LatencyMs,
    limit: latencyBudget.p95,
    unit: "ms",
    comparator: "lte"
  });
  addMetricCheck({
    metricChecks,
    blocking,
    passed,
    name: "p99 latency within budget",
    observed: scenario.metrics?.p99LatencyMs,
    limit: latencyBudget.p99,
    unit: "ms",
    comparator: "lte"
  });
  addMetricCheck({
    metricChecks,
    blocking,
    passed,
    name: "stream first-token p95 within budget",
    observed: scenario.metrics?.streamFirstTokenP95Ms,
    limit: latencyBudget.streamFirstTokenP95,
    unit: "ms",
    comparator: "lte"
  });
  addMetricCheck({
    metricChecks,
    blocking,
    passed,
    name: "error rate within budget",
    observed: scenario.metrics?.errorRatePercent,
    limit: policy.maxErrorRatePercent,
    unit: "%",
    comparator: "lte"
  });
  addMetricCheck({
    metricChecks,
    blocking,
    passed,
    name: "timeout rate within budget",
    observed: scenario.metrics?.timeoutRatePercent,
    limit: policy.maxTimeoutRatePercent,
    unit: "%",
    comparator: "lte"
  });

  addRequiredFields({
    target: scenario.fallback,
    fields: policy.requiredFallbackFields,
    prefix: "fallback",
    blocking,
    passed,
    readinessChecks
  });
  addRequiredFields({
    target: scenario.rollback,
    fields: policy.requiredRollbackFields,
    prefix: "rollback",
    blocking,
    passed,
    readinessChecks
  });
  addRequiredFields({
    target: scenario.communications,
    fields: policy.requiredCommsFields,
    prefix: "communications",
    blocking,
    passed,
    readinessChecks
  });

  const primaryCost = Number(scenario.primaryModel?.estimatedUnitCost);
  const backupCost = Number(scenario.backupModel?.estimatedUnitCost);
  const warnThreshold = Number(policy.warnIfBackupCostMultiplierAbove);
  if (Number.isFinite(primaryCost) && Number.isFinite(backupCost) && primaryCost > 0 && Number.isFinite(warnThreshold)) {
    const multiplier = backupCost / primaryCost;
    if (multiplier > warnThreshold) {
      warnings.push(`backup model estimated unit cost is ${multiplier.toFixed(2)}x primary`);
    }
  }

  if (scenario.fallback?.enabled && scenario.metrics?.errorRatePercent > 0) {
    warnings.push("exercise live fallback separately before moving production traffic");
  }

  return {
    ok: blocking.length === 0,
    status: blocking.length === 0 ? "PASS" : "FAIL",
    scenario: {
      scenarioName: scenario.scenarioName,
      serviceName: scenario.serviceName,
      baseUrl: scenario.baseUrl,
      primaryModel: scenario.primaryModel?.alias ?? null,
      backupModel: scenario.backupModel?.alias ?? null
    },
    blocking,
    warnings,
    passed,
    routeChecks,
    capabilityChecks,
    metricChecks,
    readinessChecks,
    trackedCta: policy.trackedCta ?? null,
    suggestedNextActions: [
      "Attach this report to the incident drill record.",
      "Confirm live provider pricing, rate limits, and model availability before moving production traffic.",
      "Keep rollback env vars and owner contacts current.",
      "Run endpoint smoke tests against the selected base_url after the drill."
    ]
  };
}

function pushCheck({ check, blocking, passed }) {
  if (check.ok) passed.push(check.name);
  else blocking.push(check.name);
}

function addMetricCheck({ metricChecks, blocking, passed, name, observed, limit, unit, comparator }) {
  const hasObserved = Number.isFinite(Number(observed));
  const hasLimit = Number.isFinite(Number(limit));
  const ok = hasObserved && hasLimit && comparator === "lte" && Number(observed) <= Number(limit);
  const check = {
    name,
    ok,
    observed: hasObserved ? Number(observed) : null,
    limit: hasLimit ? Number(limit) : null,
    unit
  };
  metricChecks.push(check);
  pushCheck({ check, blocking, passed });
}

function addRequiredFields({ target, fields, prefix, blocking, passed, readinessChecks }) {
  for (const field of fields ?? []) {
    const value = target?.[field];
    const ok = typeof value === "boolean" ? value === true : Boolean(value);
    const check = {
      name: `${prefix} field ready: ${field}`,
      ok,
      observed: ok ? "set" : "missing-or-false"
    };
    readinessChecks.push(check);
    pushCheck({ check, blocking, passed });
  }
}

function renderText(report) {
  const lines = [];
  lines.push("# OpenAI-Compatible SLA Incident Drill");
  lines.push("");
  lines.push(`Status: ${report.status}`);
  lines.push(`Service: ${report.scenario.serviceName}`);
  lines.push(`Base URL: ${report.scenario.baseUrl}`);
  lines.push(`Scenario: ${report.scenario.scenarioName}`);
  lines.push(`Primary model alias: ${report.scenario.primaryModel ?? "missing"}`);
  lines.push(`Backup model alias: ${report.scenario.backupModel ?? "missing"}`);
  lines.push("");
  lines.push("Blocking checks");
  if (report.blocking.length) {
    for (const item of report.blocking) lines.push(`- ${item}`);
  } else {
    lines.push("- none");
  }
  lines.push("");
  lines.push("Warnings");
  if (report.warnings.length) {
    for (const item of report.warnings) lines.push(`- ${item}`);
  } else {
    lines.push("- none");
  }
  lines.push("");
  lines.push("Metric checks");
  for (const check of report.metricChecks) {
    lines.push(`- ${check.name}: observed=${formatValue(check.observed, check.unit)}, limit=${formatValue(check.limit, check.unit)}, status=${check.ok ? "pass" : "fail"}`);
  }
  lines.push("");
  lines.push("Readiness checks");
  for (const check of report.readinessChecks) {
    lines.push(`- ${check.name}: ${check.ok ? "pass" : "fail"}`);
  }
  lines.push("");
  lines.push("Suggested next actions");
  for (const step of report.suggestedNextActions) lines.push(`- ${step}`);
  if (report.trackedCta) {
    lines.push("");
    lines.push("Tracked endpoint test CTA");
    lines.push(report.trackedCta);
  }
  return lines.join("\n");
}

function formatValue(value, unit) {
  if (value === null || value === undefined) return "missing";
  return `${value}${unit}`;
}
