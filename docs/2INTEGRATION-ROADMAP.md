# SPP v5.1 — Integration and backend roadmap

This note describes the recommended path from the front-end prototype to a production system. It is intentionally vendor-neutral until the current Shoto Point application stack and deployed API contracts are inspected.

## 1. Shared application services

| Service | Primary responsibility | Example contract areas |
|---|---|---|
| Identity & access | Login, sessions, roles and permissions | `/auth/*`, `/users/*`, `/roles/*` |
| Website & CMS | Pages, sections, menus, SEO and publishing | `/pages/*`, `/posts/*`, `/menus/*`, `/publishing/*` |
| Media | Upload lifecycle, metadata, transformations and delivery | `/media/*`, `/assets/*`, `/playlists/*` |
| Production | Projects, stages, people, deliverables and approvals | `/productions/*`, `/team/*`, `/approvals/*` |
| Community | Members, submissions, moderation and notifications | `/community/*`, `/submissions/*` |
| Broadcast & events | Programme schedules, stream metadata and events | `/broadcast/*`, `/events/*` |
| Analytics | First-party events, aggregated reports and exports | `/analytics/events`, `/analytics/reports/*` |
| Commerce | Orders, payment intents, webhooks and reconciliation | `/orders/*`, `/payments/*`, `/webhooks/*` |
| Integrations | Connection records, OAuth state, health and audit history | `/integrations/*`, `/integration-events/*` |
| AI orchestration | Provider routing, jobs, usage, asset output and review | `/ai/providers`, `/ai/jobs/*`, `/ai/usage/*` |

The route names above are examples for architecture planning, not existing endpoints.

## 2. Recommended AI provider adapter contract

Create a provider adapter per vendor. The browser should call the SPP server, not vendor APIs directly with secret credentials.

A provider record should contain:

- `id`, `display_name`, `capabilities`, `connection_state`, `enabled_for_roles`
- `credential_reference` (a secret-manager reference, never the secret itself)
- permitted models, regions, account/project references and per-model constraints
- configured budget, rate limits, timeout and retry policy
- last health-check time and sanitized error state

A generation job should contain:

- `job_id`, `project_id`, `requested_by`, `provider_id`, `model_id`, `task_type`
- validated prompt/brief and approved reference-asset IDs
- requested format, aspect ratio, duration or output settings
- state (`queued`, `running`, `succeeded`, `failed`, `cancelled`, `needs_review`)
- timestamps, sanitized provider response metadata and usage/cost records
- output asset IDs and human approval state

Suggested workflow: validate user permission and budget → enqueue job → adapter invokes provider → poll or receive signed callback → validate and scan outputs → register output in Media service → request editorial review → approve → expose to CMS or publishing queue.

Do not assume all listed AI products expose equivalent APIs. Desktop tools and services without an appropriate API should be represented as export/project hand-off workflows, not as direct server integrations.

## 3. 100-item catalogue grouping

The prototype catalogue includes exactly 100 planned entries in these groups:

| Group | Planned entries |
|---|---:|
| AI & creative | 20 |
| CMS & security | 18 |
| Analytics & SEO | 10 |
| Social media | 10 |
| Payments | 10 |
| Communications & CRM | 10 |
| Infrastructure | 15 |
| Automation | 7 |
| **Total** | **100** |

Catalogue inclusion means only that a service is proposed for evaluation. It does not mean the vendor supports an API for every desired feature, that the integration is free, or that the service is already installed or authorized.

Before implementation, check the current vendor documentation and confirm:

- API product availability and supported operations.
- OAuth, API-key, webhook and service-account support.
- Rate limits, quotas, regional availability and pricing.
- Required business/creator account tiers and app review requirements.
- Data retention, privacy terms, copyright/license conditions and data residency.
- Whether the required capability is an API, embed, plugin, export/import, deep link or manual hand-off.

## 4. Security requirements

- Keep credentials server-side; encrypt secrets at rest and rotate them.
- Enforce role-based permissions and least-privilege scopes.
- Verify webhook signatures and protect against replay.
- Rate-limit sensitive endpoints and implement idempotency for payment and publishing operations.
- Sanitize HTML and user-generated content; validate file types, sizes and media metadata.
- Use malware scanning and private quarantine for uploaded files before publication.
- Keep immutable audit events for administrator actions, payment state changes and integration configuration changes.
- Redact tokens, prompts containing sensitive data and payment details from logs.
- Require approval and budget checks for high-cost AI generation and high-impact publishing/payment actions.

## 5. Acceptance checklist

- [ ] Existing Shoto Point navigation and working controls are preserved after merge.
- [ ] No sample metric is shown as real production data.
- [ ] Website page sections can be saved, previewed and published through the actual CMS API.
- [ ] Image/video uploads include progress, validation, retry and server-side asset records.
- [ ] Video playback supports authorized media URLs, responsive delivery and captions.
- [ ] Analytics filters query the real event/report service and show timezone/date semantics.
- [ ] AI provider calls are server-mediated, permission-checked and budget-limited.
- [ ] Integration states are based on authenticated health checks, not manual visual toggles.
- [ ] Payments are verified through signed webhooks and reconciliation, never browser-only state.
- [ ] All dashboards and editors work at desktop, tablet and mobile breakpoints.
- [ ] Backups, monitoring, audit trails and rollback procedures are tested.
