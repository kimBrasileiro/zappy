output "cloud_run_url" {
  value = module.zappy.cloud_run_url
}

output "artifact_registry_repo" {
  value = module.zappy.artifact_registry_repo
}

output "cloud_sql_connection_name" {
  value = module.zappy.cloud_sql_connection_name
}

output "migration_job_name" {
  value = module.zappy.migration_job_name
}

output "secrets_to_populate" {
  value = module.zappy.secrets_to_populate
}

output "workload_identity_provider" {
  description = "Set as WIF_PROVIDER in this repo's \"spain\" GitHub Environment secrets/variables, if wiring up CI for this environment."
  value       = module.zappy.workload_identity_provider
}

output "deployer_service_account" {
  description = "Set as WIF_SERVICE_ACCOUNT in this repo's \"spain\" GitHub Environment secrets/variables, if wiring up CI for this environment."
  value       = module.zappy.deployer_service_account
}
