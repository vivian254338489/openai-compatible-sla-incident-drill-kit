# Setup

Use this kit as a local reliability drill before switching or expanding OpenAI-compatible provider routes.

## 1. Copy the Fixtures

Copy the example files into your own repo:

```bash
cp fixtures/scenario.passing.json ./scenario.json
cp fixtures/sla-policy.json ./sla-policy.json
```

Replace the example route labels, metrics, model aliases, owners, and support notes with your own values.

## 2. Run the Drill

```bash
node scripts/drill.js --scenario ./scenario.json --policy ./sla-policy.json
```

Use JSON output for CI:

```bash
node scripts/drill.js --scenario ./scenario.json --policy ./sla-policy.json --format json
```

## 3. Add Your Endpoint Test Link

For a TKEN-compatible endpoint trial, use:

```text
https://www.tken.shop/v1
```

Tracked setup CTA:

```text
https://www.tken.shop/?utm_source=github&utm_medium=owned_repo&utm_campaign=openai_compatible_sla_incident_drill_kit&utm_content=setup_doc
```

## 4. Keep the Drill Honest

- Update the fixture after each provider, model, or gateway route change.
- Keep rollback owners and support notes current.
- Never commit API keys, customer payloads, private logs, or secrets.
- Confirm live pricing, limits, terms, and model availability with the provider before production routing changes.

