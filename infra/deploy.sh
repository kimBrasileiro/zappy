#!/usr/bin/env bash
# Builds, pushes and rolls out a new revision by hand — same sequence as the
# .github/workflows/deploy.yml reusable workflow, useful for a one-off
# deploy or debugging the CI pipeline locally. Doesn't touch Terraform state
# at all (deliberately: see modules/zappy/cloud_run.tf's
# `lifecycle.ignore_changes` on the image, which exists specifically so this
# script/CI and `terraform apply` don't fight over who owns the deployed tag).
#
# Usage: infra/deploy.sh <staging|production> <gcp-project-id> [region]
set -euo pipefail

ENVIRONMENT="${1:?Usage: infra/deploy.sh <staging|production> <gcp-project-id> [region]}"
PROJECT_ID="${2:?Usage: infra/deploy.sh <staging|production> <gcp-project-id> [region]}"
REGION="${3:-southamerica-east1}"
APP_NAME="zappy"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/${APP_NAME}-${ENVIRONMENT}"
TAG="$(date +%Y%m%d-%H%M%S)"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "ENVIRONMENT must be \"staging\" or \"production\", got: $ENVIRONMENT" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Same values as infra/environments/<env>/terraform.tfvars — must match what
# was actually `terraform apply`'d, since app_url/stripe_publishable_key get
# baked into this build. Exported by you before running this script:
#   export NEXT_PUBLIC_APP_URL=https://staging.suaempresa.com
#   export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
: "${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL first (must match that environment's tfvars app_url)}"
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

JOB_NAME="${APP_NAME}-${ENVIRONMENT}-migrate"
SERVICE_NAME="${APP_NAME}-${ENVIRONMENT}-web"

echo "==> Running migrations (${JOB_NAME})"
gcloud run jobs update "$JOB_NAME" \
  --project "$PROJECT_ID" --region "$REGION" \
  --image "${REPO}/web:build-${TAG}"
gcloud run jobs execute "$JOB_NAME" \
  --project "$PROJECT_ID" --region "$REGION" --wait

echo "==> Migrations OK — deploying web service (${SERVICE_NAME})"
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" --region "$REGION" \
  --image "${REPO}/web:${TAG}"

echo "==> Done: ${REPO}/web:${TAG}"
