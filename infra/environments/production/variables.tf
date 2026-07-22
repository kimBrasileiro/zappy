# Thin pass-through to modules/zappy — see that module's variables.tf for
# full descriptions of what each of these actually does/costs.

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "southamerica-east1"
}

variable "github_repo" {
  description = "\"owner/repo\", e.g. \"kimBrasileiro/zappy\" — see modules/zappy/wif.tf."
  type        = string
  default     = "kimBrasileiro/zappy"
}

variable "container_image" {
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "migration_image" {
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "app_url" {
  type    = string
  default = ""
}

variable "stripe_publishable_key" {
  description = "Use a pk_live_... key here once you're actually taking real payments."
  type        = string
  default     = ""
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "resend_from_email" {
  type    = string
  default = "Zappy <onboarding@resend.dev>"
}

variable "whatsapp_phone_number_id" {
  type    = string
  default = ""
}

variable "whatsapp_number" {
  type    = string
  default = ""
}

variable "min_instances" {
  description = "Consider 1 for production once you have real customers — avoids the ~1-2s cold start on their very first request of the day."
  type        = number
  default     = 0
}

variable "max_instances" {
  type    = number
  default = 5
}

variable "db_tier" {
  description = "db-f1-micro is the floor — revisit before real customer load (see ../../README.md#cost)."
  type        = string
  default     = "db-f1-micro"
}

variable "db_availability_type" {
  description = "Consider REGIONAL (HA standby, ~2x Cloud SQL cost) once downtime actually matters to real customers."
  type        = string
  default     = "ZONAL"
}

variable "db_disk_size_gb" {
  type    = number
  default = 10
}

variable "db_deletion_protection" {
  description = "Stays true. Never flip this to destroy production by accident."
  type        = bool
  default     = true
}
