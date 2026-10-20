# Contributing to Zappigo

Thanks for taking a look — contributions, bug reports and ideas are welcome.

## Before you start

- **Small fixes / bugs**: just open a PR.
- **Anything bigger** (a new integration, a new booking modality, a schema
  change): open an issue first describing what you want to do and why, so
  we can agree on the approach before you put time into it.

## Development setup

See the [README](README.md#getting-started) — `pnpm install`, copy
`.env.example`, a local Postgres container, `pnpm db:migrate`, `pnpm dev`.

## Before opening a PR

```bash
pnpm typecheck
pnpm lint
pnpm eval        # if you touched the bot/orchestrator — see eval/README.md
```

A few conventions the codebase leans on throughout, worth matching:

- **Never confirm an action the database didn't actually perform.** The
  bot's tools (`apps/web/lib/bot/*-tools.ts`) only report success after the
  write actually happened — this is the single most important invariant in
  the whole project. Any new tool must follow the same shape.
- **Guard new modalities/features behind an explicit check**, not a
  behavior change in the shared path. See `lib/modality.ts` and how
  `orchestrator.ts` branches on `isSportsCompany(company)` — the
  appointments flow (barbearia/salão/pet shop) must never change shape as
  a side effect of adding something else.
- **Multi-tenant by construction.** Every query that touches tenant data is
  scoped by `companyId` pulled from the authenticated session or the
  resolved company — never trust an id from the client alone.
- Comments in this codebase tend to explain *why*, not *what* — match that
  density rather than narrating the code line by line.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened instead,
and enough to reproduce it (a scenario for `eval/`, if it's bot behavior, is
the most useful form a bug report can take).

## Security issues

Please don't open a public issue — see [SECURITY.md](SECURITY.md).
