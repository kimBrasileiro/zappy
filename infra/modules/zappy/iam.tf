# One service account shared by the web service and the migration job —
# both need the exact same two things (talk to this Cloud SQL instance, read
# these secrets), and splitting them would only mean keeping two IAM
# bindings lists in sync for no isolation benefit (a migration job that can
# write to the DB isn't a bigger blast radius than a web service that can).
#
# Separate from the CI/CD deploy identity in wif.tf on purpose: this account
# never leaves GCP (Cloud Run assumes it directly), the deployer account is
# the only one GitHub Actions can ever impersonate, and it can't read these
# secrets at all — only push images and call `gcloud run deploy` (see
# wif.tf's IAM bindings).
resource "google_service_account" "runtime" {
  account_id   = "${local.name}-runtime"
  display_name = "${local.name} Cloud Run runtime (web + migration job)"
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Scoped per-secret (not a blanket secretmanager.secretAccessor on the whole
# project) so this service account only ever reads this environment's own
# ${local.name}-* secrets, never the other environment's.
resource "google_secret_manager_secret_iam_member" "database_url_access" {
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each = google_secret_manager_secret.runtime

  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
