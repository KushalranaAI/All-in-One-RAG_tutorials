# Incident Response Runbook

## Severity levels
- **SEV1**: full outage or data loss affecting many customers. Page the on-call immediately.
- **SEV2**: major feature degraded for many customers. Respond within 30 minutes.
- **SEV3**: minor issue or a single customer affected. Respond within one business day.

## Steps for a SEV1
1. Acknowledge the page in PagerDuty within 5 minutes.
2. Open an incident channel named `#inc-YYYYMMDD-short-name`.
3. Assign an Incident Commander (IC) and a Communications Lead.
4. Post a status page update within 15 minutes and every 30 minutes after.
5. After resolution, write a blameless postmortem within 5 business days.

## Rollback
Use `nimbus deploy rollback --to <release-id>`. Rollbacks complete in under 2 minutes for most services.
