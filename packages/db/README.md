# @zappigo/db

Prisma schema (multi-file, `prisma/schema/*.prisma`) + migrations for the multi-tenant support platform.

## Version pin

`prisma` / `@prisma/client` are pinned to `^6.7.0 <7.0.0`. The multi-file schema
folder feature (`prismaSchemaFolder`) went GA in 6.7.0, but there is an open
upstream issue affecting multi-file schema migration/generation specifically
on 7.0.0 (prisma/prisma#28673). Re-evaluate this pin when that's resolved.

## Commands

| Script | What it does |
|---|---|
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` (local/dev only) |
| `db:migrate:prod` | `prisma migrate deploy` (used by the Cloud Run migration job, see infra/cloud_run_job.tf — no shadow DB) |
| `db:migrate:status` | `prisma migrate status` |
| `db:migration:new -- <name>` | `prisma migrate dev --create-only --name <name>` — generates the migration SQL Prisma can infer and stops before applying, so hand-written statements (partial indexes, extensions, etc) can be added first |
| `db:seed` | `prisma db seed` |
| `db:studio` | `prisma studio` |

## Rollback limitation (read before you need it)

Prisma has **no native down-migration** in its dev workflow. `db:migrate:rollback`
deliberately fails loudly (see `scripts/rollback-unsupported.js`) instead of
faking a revert. Real options:

- **Dev only, destructive**: `pnpm db:migrate:reset` — drops the database and replays every migration from scratch.
- **Staging/production**: write a new forward migration that reverses the change (`db:migration:new -- revert_<name>`), then `db:migrate:prod`.
- **Production incident**: restore the Cloud SQL instance from an automated backup / point-in-time recovery (see infra/README.md).
