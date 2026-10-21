# Zappigo

Multi-tenant AI customer-support + booking SaaS: a website chat widget and a
WhatsApp Cloud API bot, sharing one orchestrator, that actually book real
appointments (or, for sports-court venues, group classes and court
reservations), answer a company's own FAQ, and hand off to a human the
moment they're unsure — never inventing an answer or a confirmation.

Live at [zappigo.com.br](https://zappigo.com.br). MIT licensed — see
[LICENSE](LICENSE).

## What's here

- **The bot** (`apps/web/lib/bot/`) — one tool-calling orchestrator shared
  by the website widget and WhatsApp, with per-tenant guardrails: never
  confirms a booking the database didn't actually create, escalates to a
  human the moment it doesn't know, hard rate limits, cross-tenant leak
  checks. Two booking models live side by side, picked per company by
  `Company.config.modality`: exclusive-slot services (barbearia, salão, pet
  shop, …) and group classes with seats/levels/courts (sports venues) —
  see `lib/modality.ts`.
- **The dashboard** (`apps/web/app/dashboard/`) — inbox, bookings/agenda,
  services or classes, client CRM with per-client history, financial
  reports (per client/staff/service, by week/month/custom range), FAQ and
  quick-reply management, WhatsApp/Google Calendar integrations, billing.
- **The embeddable widget** (`apps/widget/`) — vanilla TypeScript, Shadow
  DOM isolated, bundled under 30KB gzipped, talks to the same `/api/chat`
  the dashboard and WhatsApp webhook use.
- **Billing** — Stripe subscriptions, a 7-day trial, usage-based monthly
  message quota with an automatic warning.
- **i18n** — pt-BR (default), en, es throughout the marketing site, the
  dashboard, and the bot's own replies.

## Tech stack

Next.js 14 (App Router) · TypeScript · Prisma 6 (multi-file schema) ·
PostgreSQL 16 · better-auth · Stripe · Google Gemini (the bot's only LLM
provider) · Resend (email) · Meta WhatsApp Cloud API · Google Calendar API ·
Turborepo + pnpm workspaces · Terraform on Google Cloud Run / Cloud SQL.

## Monorepo layout

```
apps/
  web/        Next.js app — dashboard, marketing site, booking widget host,
              API routes (chat, WhatsApp webhook, cron), the bot itself
  widget/     the embeddable chat widget (builds into apps/web/public)
packages/
  db/         Prisma schema + migrations + generated client (@zappigo/db)
  types/      shared TypeScript types (@zappigo/types)
eval/         behavioral eval suite for the bot — see eval/README.md
infra/        Terraform (GCP) + GitHub Actions CI/CD — see infra/README.md
scripts/      standalone GTM tooling (lead-list building, outreach prep,
              WhatsApp template submission) — not part of the deployed app
```

## Getting started

Requirements: Node 20.10+ (see `.nvmrc`), pnpm 10.x (`packageManager` field —
Corepack picks it up automatically), and Docker for a local Postgres.

```bash
pnpm install
cp .env.example .env.local   # fill in at least DATABASE_URL, BETTER_AUTH_SECRET, GEMINI_API_KEY

# Local Postgres 16, if you don't already have one:
docker run -d --name zappigo-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=zappigo -p 5432:5432 postgres:16

pnpm db:generate    # generates the Prisma client — do this before anything below
                    # touches the database or typechecks against it
pnpm db:migrate     # applies every migration
pnpm db:seed        # one demo company + admin user (Acme Demo / admin@acme-demo.test)
pnpm dev            # runs apps/web (and apps/widget in watch mode) via Turborepo
```

The app boots with no Stripe/WhatsApp/Gemini keys at all — it just falls
back to the pre-billing signup flow, no bot replies, no WhatsApp. Every
other integration is additive: see `.env.example` for what each variable
unlocks and why, and `packages/db/README.md` for the full Prisma command
reference (including the migration-rollback limitation).

## Testing

```bash
pnpm typecheck   # tsc --noEmit, every package
pnpm lint        # eslint, every package
pnpm eval        # scripted conversations against the real orchestrator,
                 # graded by deterministic assertions + an LLM judge —
                 # see eval/README.md
```

## Deploying

See [infra/README.md](infra/README.md) — Terraform module for Cloud Run +
Cloud SQL + Secret Manager, two isolated environments (staging/production),
deployed by GitHub Actions via Workload Identity Federation (no
service-account keys in repo secrets). `infra/deploy.sh` does the same
build→push→migrate→deploy steps by hand if you'd rather not wait on CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Found a security issue? Please
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

MIT — see [LICENSE](LICENSE).
