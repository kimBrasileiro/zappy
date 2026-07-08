# syntax=docker/dockerfile:1
FROM node:20.10.0-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @zappy/db db:generate
RUN pnpm --filter @zappy/web build

# The "build" stage still has the full workspace + node_modules + prisma CLI,
# so infra/lib/ecs-stack.ts builds this image with `--target build` for the
# migration task definition and overrides its command to:
#   ["pnpm", "--filter", "@zappy/db", "db:migrate:prod"]
# The pruned "runner" stage below is used for the web service only.

FROM build AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
