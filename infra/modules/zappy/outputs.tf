output "cloud_run_url" {
  description = "Public URL of the deployed web service."
  value       = google_cloud_run_v2_service.web.uri
}

output "artifact_registry_repo" {
  description = "Docker push target, e.g. docker push <this>/web:latest"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name (PROJECT:REGION:INSTANCE) — used by the Cloud SQL Auth Proxy for local access."
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_sql_instance_ip" {
  description = "Cloud SQL public IP — only reachable if your local machine's IP is authorized, Cloud Run itself never uses this path."
  value       = google_sql_database_instance.main.public_ip_address
}

output "runtime_service_account" {
  description = "Service account both the web service and the migration job run as."
  value       = google_service_account.runtime.email
}

output "migration_job_name" {
  description = "Name to pass to `gcloud run jobs execute`."
  value       = google_cloud_run_v2_job.migrate.name
}

output "secrets_to_populate" {
  description = "Secret Manager secret ids that Terraform created empty — populate before Cloud Run can actually start."
  value       = [for s in google_secret_manager_secret.runtime : s.secret_id]
}

# --- CI/CD (wif.tf) --------------------------------------------------------

output "workload_identity_provider" {
  description = "Full resource name to set as `workload_identity_provider` in the GitHub Actions workflow's google-github-actions/auth step."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "Email to set as `service_account` in the GitHub Actions workflow's google-github-actions/auth step."
  value       = google_service_account.deployer.email
}

# --- Monitoring/alerting (monitoring.tf) -----------------------------------

output "alert_notification_channel" {
  description = "Email notification channel alert policies fire through — confirm this shows up (and its `email_address`) in Cloud Monitoring after apply."
  value       = var.app_url != "" ? google_monitoring_notification_channel.alert_email[0].id : null
}
