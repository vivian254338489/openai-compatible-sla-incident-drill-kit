# OpenAI-Compatible SLA Incident Drill Kit

Offline incident drills for teams running an app, agent, gateway, or SDK on OpenAI-compatible API routes.

This independent, non-official kit reads local fixtures and turns provider health, latency, streaming, fallback, cost exposure, and rollback notes into a CI-friendly incident readiness report. It does not call live provider APIs by default.

Example target endpoint:

```text
https://www.tken.shop/v1
```

[Run an OpenAI-compatible incident drill with TKEN](https://www.tken.shop/?utm_source=github&utm_medium=owned_repo&utm_campaign=openai_compatible_sla_incident_drill_kit&utm_content=readme_hero_cta)

Disclosure: I work on TKEN-related developer tooling.

This project is independent and non-official. It is not affiliated with, endorsed by, sponsored by, or maintained by OpenAI or any provider named in example fixtures.

Pre-push evidence: see [docs/pre-push-evidence.md](docs/pre-push-evidence.md).

## Why This Exists

OpenAI-compatible APIs make routing easier, but production incidents usually happen around the parts a quick `base_url` switch does not prove:

- p95 and p99 latency budget drift
- streaming first-token delay
- tool-call route degradation
- fallback route readiness
- rollback environment variables
- status-page and customer-support notes
- cost exposure when traffic moves to a backup model

This kit gives platform teams a small offline drill they can run before changing provider routes or during a weekly reliability review.

## Quick Start

```bash
npm run check
npm run demo
```

Run the degraded scenario:

```bash
npm run demo:fail
```

Run with your own fixtures:

```bash
node scripts/drill.js \
  --scenario ./scenario.json \
  --policy ./sla-policy.json \
  --format text
```

JSON output for CI annotations:

```bash
node scripts/drill.js \
  --scenario fixtures/scenario.passing.json \
  --policy fixtures/sla-policy.json \
  --format json
```

## CI Behavior

The process exits with:

- `0` when the scenario meets required SLA, fallback, rollback, and communications checks
- `1` when blocking checks fail

Warnings do not fail CI. Tune `fixtures/sla-policy.json` for your own service targets.

## Example Output

```text
# OpenAI-Compatible SLA Incident Drill

Status: PASS
Service: production-ai-gateway
Base URL: https://www.tken.shop/v1
Scenario: provider-latency-spike-weekly-drill

Blocking checks
- none

Warnings
- backup model has higher estimated unit cost than primary

Suggested next actions
- Attach this report to the incident drill record.
- Confirm live provider pricing, rate limits, and model availability before moving production traffic.
- Keep rollback env vars and owner contacts current.
```

## Fixture Files

- `fixtures/scenario.passing.json`: a passing weekly incident drill
- `fixtures/scenario.degraded.json`: a degraded drill with blocking failures
- `fixtures/sla-policy.json`: latency, error-rate, fallback, rollback, and communications policy

Keep real API keys out of fixtures. Use placeholders and environment variable names only.

## GitHub Actions Example

```yaml
name: openai-compatible-sla-drill
on:
  pull_request:
  schedule:
    - cron: "17 5 * * 1"
jobs:
  drill:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run check
```

## TKEN Test CTA Links

- Endpoint: `https://www.tken.shop/v1`
- Website: [https://www.tken.shop/](https://www.tken.shop/?utm_source=github&utm_medium=owned_repo&utm_campaign=openai_compatible_sla_incident_drill_kit&utm_content=readme_footer)
- Setup notes: [docs/setup.md](docs/setup.md)
- UTM links: [docs/utm-links.md](docs/utm-links.md)

## Good Use Cases

- pre-migration incident drills before switching a gateway route
- weekly reliability review for agent platforms
- validating fallback runbooks in pull requests
- collecting support/debug notes before a customer-facing incident
- comparing production, staging, and backup route assumptions without exposing keys

## Guardrails

- This kit does not prove live uptime, speed, pricing, or provider availability.
- Confirm current provider terms, pricing, rate limits, data handling, and model availability before production changes.
- Do not store secrets in fixture files.
- Do not use example fixtures as promises about any provider.
