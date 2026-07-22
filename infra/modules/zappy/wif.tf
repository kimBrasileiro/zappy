# Lets GitHub Actions deploy without a downloaded service-account JSON key —
# it exchanges a short-lived OIDC token from GitHub for a short-lived GCP
# access token, scoped to exactly this environment. See
# ../../../.github/workflows/deploy-staging.yml / deploy-production.yml for
# the consuming side (google-github-actions/auth).
#
# One pool+provider per environment (not one shared pool for both) — a
# staging pool misconfiguration can never grant access to production's
# service account, full stop, regardless of what IAM bindings exist.
resource "google_iam_workload_identity_pool" "github" {
  depends_on = [google_project_service.apis]

  workload_identity_pool_id = "${local.name}-pool"
  display_name              = "${local.name} GitHub Actions"
  description               = "Workload Identity Federation pool for ${var.github_repo} (${var.environment}) — no service account keys."
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.repository"  = "assertion.repository"
    "attribute.environment" = "assertion.environment"
  }

  # The security boundary: without this, ANY workflow in ANY GitHub repo
  # that can get a token from token.actions.githubusercontent.com could ask
  # to impersonate this environment's deployer (the IAM binding below only
  # narrows *which* principals within this provider are trusted — this is
  # what stops untrusted tokens from using the provider at all). Requires
  # the workflow job to declare `environment: staging` / `environment:
  # production` (GitHub's "Environments" feature) — that's what puts the
  # `environment` claim in the OIDC token in the first place, and it's also
  # what gives production its required-reviewer approval gate.
  attribute_condition = "assertion.repository == \"${var.github_repo}\" && assertion.environment == \"${var.environment}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# The identity GitHub Actions actually becomes for the duration of a deploy
# — intentionally NOT the same account Cloud Run runs as (google_service_
# account.runtime in iam.tf): this one can push images and trigger
# deploys/job-runs, but can't read a single application secret.
resource "google_service_account" "deployer" {
  account_id   = "${local.name}-deployer"
  display_name = "${local.name} GitHub Actions deployer"
}

resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.deployer.name
  role                = "roles/iam.workloadIdentityUser"
  member              = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# Push new images.
resource "google_artifact_registry_repository_iam_member" "deployer_push" {
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

# Roll out a new revision / update+execute the migration job.
resource "google_cloud_run_v2_service_iam_member" "deployer_run" {
  name     = google_cloud_run_v2_service.web.name
  location = google_cloud_run_v2_service.web.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deployer_run" {
  name     = google_cloud_run_v2_job.migrate.name
  location = google_cloud_run_v2_job.migrate.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# Required for `gcloud run deploy`/`gcloud run jobs update` to attach
# google_service_account.runtime to the new revision/execution — deploying
# as a service account you're not allowed to "act as" is a hard GCP error,
# not just a permissions warning.
resource "google_service_account_iam_member" "deployer_can_run_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role                = "roles/iam.serviceAccountUser"
  member              = "serviceAccount:${google_service_account.deployer.email}"
}
