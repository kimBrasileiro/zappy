// Prisma has no native down-migration command in its dev workflow. This
// script exists so `db:migrate:rollback` fails loudly with real options
// instead of silently doing nothing or pretending to revert a migration.
console.error(`
Prisma does not support automatic migration rollback.

Choose one of:
  - Dev only, destructive: pnpm db:migrate:reset
    (drops the database and replays every migration from scratch)
  - Staging/production: write a new forward migration that reverses the
    change (pnpm db:migration:new -- revert_<name>), then pnpm db:migrate:prod
  - Production incident: restore the Aurora cluster from an automated
    snapshot / point-in-time recovery
`);
process.exit(1);
