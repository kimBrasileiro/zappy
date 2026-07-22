#!/usr/bin/env bash
# Pauses/resumes the Cloud SQL instance to cut cost between test sessions —
# stopped, you pay only for provisioned disk (~$1-2/mo for 10GB), not the
# compute (the bulk of the bill, ~$12-14/mo for db-f1-micro). Cloud Run
# itself needs no equivalent toggle — min_instances=0 already means $0 while
# idle, this script only exists because Cloud SQL has no such thing.
#
# Usage: infra/toggle-db.sh <staging|production> <start|stop> [gcp-project-id]
set -euo pipefail

ENVIRONMENT="${1:?Usage: infra/toggle-db.sh <staging|production> <start|stop> [gcp-project-id]}"
ACTION="${2:?Usage: infra/toggle-db.sh <staging|production> <start|stop> [gcp-project-id]}"
PROJECT_ID="${3:-}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "ENVIRONMENT must be \"staging\" or \"production\", got: $ENVIRONMENT" >&2
  exit 1
fi

case "$ACTION" in
  stop)  POLICY="NEVER" ;;
  start) POLICY="ALWAYS" ;;
  *)
    echo "ACTION must be \"start\" or \"stop\", got: $ACTION" >&2
    exit 1
    ;;
esac

PROJECT_FLAG=()
if [[ -n "$PROJECT_ID" ]]; then
  PROJECT_FLAG=(--project "$PROJECT_ID")
fi

INSTANCE="zappy-${ENVIRONMENT}-pg"

echo "==> ${ACTION}ping ${INSTANCE}..."
gcloud sql instances patch "$INSTANCE" "${PROJECT_FLAG[@]}" --activation-policy="$POLICY" --quiet

if [[ "$ACTION" == "start" ]]; then
  echo "==> Waiting for ${INSTANCE} to come back up (usually well under a minute)..."
  until gcloud sql instances describe "$INSTANCE" "${PROJECT_FLAG[@]}" --format="value(state)" 2>/dev/null | grep -q RUNNABLE; do
    sleep 3
  done
  echo "==> ${INSTANCE} is RUNNABLE."
else
  echo "==> ${INSTANCE} stopping (billing for compute stops once it settles into STOPPED; disk storage is still billed)."
fi
