# Thin pass-through to modules/zappy — see that module's variables.tf for
# full descriptions of what each of these actually does/costs. Only vars
# that plausibly differ between staging and production are declared here;
# environment/app_name are hardcoded in main.tf instead of exposed.

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
  type    = string
  default = ""
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "google_calendar_client_id" {
  type    = string
  default = ""
}

variable "resend_from_email" {
  type    = string
  default = "Zappigo <naoresponda@mail.zappigo.com.br>"
}

variable "pricing_amount_basico" {
  type    = string
  default = "19"
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
  type    = number
  default = 0
}

variable "max_instances" {
  description = "Kept low on staging — this environment should never need to absorb real customer traffic spikes."
  type        = number
  default     = 2
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "db_availability_type" {
  type    = string
  default = "ZONAL"
}

variable "db_disk_size_gb" {
  type    = number
  default = 10
}

variable "db_deletion_protection" {
  description = "True — staging is currently doubling as production while Zappigo is free (see zappigo.com.br domain mapping), so its data isn't disposable anymore. Flip back to false only if this environment goes back to being a throwaway test DB."
  type        = bool
  default     = true
}
