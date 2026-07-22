#!/usr/bin/env bash
# Builds, pushes and rolls out a new revision — the fast path for iterating
# after the one-time Terraform bootstrap in README.md. Doesn't touch
# Terraform state at all (deliberately: see cloud_run.tf/cloud_run_job.tf's
# `lifecycle.ignore_changes` on the image, which exists specifically so this
# script and `terraform apply` don't fight over who owns the deployed tag).
#
# Usage: infra/deploy.sh <gcp-project-id> [region]
set -euo pipefail

PROJECT_ID="${1:?Usage: infra/deploy.sh <gcp-project-id> [region]}"
REGION="${2:-southamerica-east1}"
APP_NAME="zappy"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/${APP_NAME}"
TAG="$(date +%Y%m%d-%H%M%S)"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Same values as infra/terraform.tfvars — must match what was actually
# `terraform apply`'d, since app_url/stripe_publishable_key get baked into
# this build. Exported by you before running this script:
#   export NEXT_PUBLIC_APP_URL=https://app.suaempresa.com
#   export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
: "${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL first (must match infra/terraform.tfvars' app_url)}"
: "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:=}"

echo "==> Building runner image (web service)"
docker build \
  --target runner \
  --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  -f apps/web/Dockerfile \
  -t "${REPO}/web:${TAG}" \
  -t "${REPO}/web:latest" \
  .

echo "==> Building build-stage image (migration job)"
docker build \
  --target build \
  -f apps/web/Dockerfile \
  -t "${REPO}/web:build-${TAG}" \
  -t "${REPO}/web:build-latest" \
  .

echo "==> Pushing both images"
docker push "${REPO}/web:${TAG}"
docker push "${REPO}/web:latest"
docker push "${REPO}/web:build-${TAG}"
docker push "${REPO}/web:build-latest"

echo "==> Running migrations (${APP_NAME}-migrate)"
gcloud run jobs update "${APP_NAME}-migrate" \
  --project "$PROJECT_ID" --region "$REGION" \
  --image "${REPO}/web:build-${TAG}"
gcloud run jobs execute "${APP_NAME}-migrate" \
  --project "$PROJECT_ID" --region "$REGION" --wait

echo "==> Migrations OK — deploying web service"
gcloud run deploy "${APP_NAME}-web" \
  --project "$PROJECT_ID" --region "$REGION" \
  --image "${REPO}/web:${TAG}"

echo "==> Done: ${REPO}/web:${TAG}"
