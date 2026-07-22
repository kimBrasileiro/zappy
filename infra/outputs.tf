output "cloud_run_url" {
  description = "Public URL of the deployed web service."
  value       = google_cloud_run_v2_service.web.uri
}

output "artifact_registry_repo" {
  description = "Docker push target, e.g. docker push <this>/web:latest"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name (PROJECT:REGION:INSTANCE) — used by the Cloud SQL Auth Proxy for local access, see README#connecting-locally."
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_sql_instance_ip" {
  description = "Cloud SQL public IP — only reachable if your local machine's IP is authorized (see README#connecting-locally), Cloud Run itself never uses this path."
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
  description = "Secret Manager secret ids that Terraform created empty — see README step 4."
  value       = [for s in google_secret_manager_secret.runtime : s.secret_id]
}
