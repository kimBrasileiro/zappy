# Thin pass-through to modules/zappy — see that module's variables.tf for
# full descriptions of what each of these actually does/costs.
#
# This is its own GCP project (not staging/production of the Brazil
# deployment) — a genuinely separate market (zappigo.es) with its own
# domain, its own currency, and its own default language, so it gets its
# own environment directory instead of reusing ../production. Inside this
# project, module.environment is still "production" (see main.tf) — that's
# the module's own staging/production concept, and there's no staging
# counterpart here per the "just production for now" decision.

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-southwest1" # Madrid — actual GCP Spain region
}

variable "github_repo" {
  type    = string
  default = "kimBrasileiro/zappy"
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
  description = "Leave unset for the free-tier launch (matches zappigo.com.br's own launch strategy) — set a pk_live_... EUR-account key once this market starts charging."
  type        = string
  default     = ""
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
  default = "Zappigo <onboarding@resend.dev>"
}

variable "whatsapp_phone_number_id" {
  type    = string
  default = ""
}

variable "whatsapp_number" {
  type    = string
  default = ""
}

variable "whatsapp_default_country_code" {
  type    = string
  default = "34"
}

# --- Locale/pricing (see modules/zappy/variables.tf) ----------------------

variable "default_locale" {
  type    = string
  default = "es"
}

variable "default_timezone" {
  type    = string
  default = "Europe/Madrid"
}

variable "pricing_currency_symbol" {
  # ASCII on purpose — the real € character got silently mangled into "?"
  # somewhere in the Terraform-on-Windows -> GCP transmission chain when
  # this was "€" (source .tf file itself has correct UTF-8 bytes, verified
  # with xxd; the corruption happens downstream, not worth chasing a
  # codepage bug for a currency symbol). "EUR 197" reads perfectly fine and
  # matches PRICING_CURRENCY_CODE, which is pure ASCII and transmits fine.
  type    = string
  default = "EUR"
}

variable "pricing_currency_code" {
  type    = string
  default = "EUR"
}

variable "pricing_amount_free" {
  type    = string
  default = "0"
}

variable "pricing_amount_basico" {
  type    = string
  default = ""
}

# --- Sizing / DB (kept at the same cheap defaults as staging — this is a
# brand-new market with zero traffic yet; revisit once real usage exists) --

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 3
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
  type    = bool
  default = true
}
