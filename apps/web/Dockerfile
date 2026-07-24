# syntax=docker/dockerfile:1
FROM node:20.10.0-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/widget/package.json apps/widget/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @zappigo/db db:generate
# apps/web/public/widget.js is gitignored (build output, not source) —
# @zappigo/widget's own build script writes it there directly (see
# apps/widget/scripts/copy-to-web.js). Nothing else produces this file, so a
# clean checkout (CI, or anyone besides whoever last ran the widget build
# locally) would otherwise ship apps/web/public without it.
RUN pnpm --filter @zappigo/widget build

# Next.js inlines every NEXT_PUBLIC_* var into the client bundle at build
# time — passing these only as Cloud Run *runtime* env vars (infra/cloud_run.tf)
# would ship a bundle with them permanently empty. Must be supplied as
# `docker build --build-arg` (see infra/README.md#chicken-and-egg-app-url).
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

RUN pnpm --filter @zappigo/web build

# The "build" stage still has the full workspace + node_modules + prisma CLI,
# so infra/cloud_run_job.tf's migration job builds this image with
# `--target build` and overrides its command to:
#   ["pnpm", "--filter", "@zappigo/db", "db:migrate:prod"]
# The pruned "runner" stage below is used for the web service only.

FROM build AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
