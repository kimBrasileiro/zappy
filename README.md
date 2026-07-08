# Chat IA

Multi-tenant AI customer-support SaaS (website chat widget + WhatsApp Cloud API, shared backend/orchestrator).

This is the **phase 1 scaffold**: monorepo structure, database migrations, and CDK infrastructure skeleton. The bot orchestrator, guardrails, AI failover, widget bundle, WhatsApp webhook, and dashboard UI are built in later phases.

## Requirements

- Node 20.10.0 (see `.nvmrc`)
- pnpm 10.x (`packageManager` field, Corepack-compatible)
- Docker (for a local `pgvector/pgvector:pg16` Postgres, and for building the ECS images)
- AWS CLI + CDK bootstrap in the target account/region (only needed for `cdk deploy`, not for local dev)

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum

# Local Postgres with pgvector, if you don't already have one:
docker run -d --name chat-ia-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=chat_ia -p 5432:5432 pgvector/pgvector:pg16

pnpm db:migrate     # applies all 9 migrations
pnpm db:seed        # demo company + admin user
pnpm dev            # runs apps/web (and future apps) via Turborepo
```

See [packages/db/README.md](packages/db/README.md) for the full Prisma command reference and the migration-rollback limitation.

## Infra (CDK)

```bash
cd infra
pnpm install
npx cdk synth      # sanity-check the stacks compile, no AWS credentials needed
npx cdk diff        # requires AWS credentials + prior bootstrap
npx cdk deploy      # do not run without explicit confirmation — provisions real, billable AWS resources
```

## Monorepo layout

- `apps/web` — Next.js 14+ App Router dashboard + API routes
- `apps/widget` — vanilla TS chat widget (placeholder in phase 1)
- `packages/db` — Prisma schema + migrations + client
- `packages/types` — shared DTOs
- `infra` — AWS CDK app
- `eval` — bot evaluation framework (placeholder in phase 1)
