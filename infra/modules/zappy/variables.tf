variable "project_id" {
  description = "GCP project id to deploy into."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Cloud SQL and Artifact Registry."
  type        = string
  default     = "southamerica-east1" # São Paulo — closest region to Brazil-based customers
}

variable "app_name" {
  description = "Prefix used for every resource name."
  type        = string
  default     = "zappy"
}

variable "environment" {
  description = <<-EOT
    "staging" or "production" — appended to every resource name (see
    local.name in main.tf) so both environments can live in the same GCP
    project without colliding, and used as the Workload Identity Federation
    provider's required OIDC claim (wif.tf) so staging's GitHub Actions
    credentials can never deploy to production or vice versa.
  EOT
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be \"staging\" or \"production\"."
  }
}

variable "github_repo" {
  description = "GitHub repo allowed to assume this environment's deploy identity, as \"owner/repo\" — see wif.tf."
  type        = string
}

# --- Container image ---------------------------------------------------

variable "container_image" {
  description = <<-EOT
    Full image reference to deploy for the web service, built from the
    `runner` stage of apps/web/Dockerfile, e.g.
    "southamerica-east1-docker.pkg.dev/PROJECT/zappy-staging/web:latest".
    Left as the placeholder on the very first `terraform apply` (see
    ../../README.md step 3) — Cloud Run then gets bootstrapped with a public
    hello-world image so the service exists and Artifact Registry has
    somewhere to push to; re-run `terraform apply` once you've pushed a real
    image (or just let the deploy-staging/deploy-production GitHub Actions
    workflow do it).
  EOT
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "migration_image" {
  description = <<-EOT
    Image reference for the migration job, built from the `build` stage of
    apps/web/Dockerfile (--target build) — that stage still has the full
    workspace + Prisma CLI, unlike the pruned `runner` stage above. Same
    bootstrap placeholder story as container_image.
  EOT
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

# --- Plain (non-secret) runtime config -----------------------------------
# Actual secrets live in Secret Manager (secrets.tf) instead of here so they
# never end up in a .tfvars file or Terraform state diff in plaintext review.

variable "app_url" {
  description = <<-EOT
    Public URL this app is served at, e.g. "https://staging.suaempresa.com"
    or the Cloud Run default "https://zappy-staging-web-xxxx.a.run.app".
    Baked into the client bundle at *build* time (Next.js inlines
    NEXT_PUBLIC_ vars) — see ../../README.md#chicken-and-egg-app-url for the
    two-pass bootstrap this implies if you don't have a custom domain picked
    yet.
  EOT
  type    = string
  default = ""
}

variable "stripe_publishable_key" {
  description = "Stripe pk_live_/pk_test_... — not secret (it's shipped to the browser), but still build-time-only like app_url above. Use pk_test_ for staging, pk_live_ for production."
  type        = string
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client id (public half of the credential pair; the secret half lives in Secret Manager)."
  type        = string
  default     = ""
}

# Separate OAuth Client from google_client_id above, on purpose — that one is
# the login flow (better-auth, scoped to openid/email/profile); this one is
# the per-company Google Calendar connection (scoped to calendar, a sensitive
# scope), see apps/web/app/api/integrations/google-calendar/*. Keeping them
# as two Google Cloud OAuth Clients means a compromised Calendar credential
# never exposes the login flow or vice versa.
variable "google_calendar_client_id" {
  description = "Google OAuth client id for the Calendar integration (public half; secret half is GOOGLE_CALENDAR_CLIENT_SECRET in Secret Manager)."
  type        = string
  default     = ""
}

variable "resend_from_email" {
  type    = string
  default = "Zappy <onboarding@resend.dev>"
}

variable "whatsapp_phone_number_id" {
  description = "Meta Cloud API phone_number_id — not secret, just an identifier."
  type        = string
  default     = ""
}

variable "whatsapp_number" {
  description = "The shared WhatsApp number itself (E.164), shown to customers in wa.me links — not secret."
  type        = string
  default     = ""
}

variable "whatsapp_default_country_code" {
  description = <<-EOT
    Country calling code (digits only, no "+") assumed for phone numbers
    that don't carry one of their own — i.e. what a customer types into the
    web widget's booking form (see lib/whatsapp/client.ts#toLocalPhone/
    toWhatsAppPhone). Empty = "55" (Brazil), matching this codebase's
    original behavior. Set to "34" for a Spain deployment so widget-typed
    local numbers round-trip to valid wa.me numbers instead of getting a
    Brazilian country code wrongly prepended.
  EOT
  type        = string
  default     = ""
}

# --- Deployment-level locale/pricing (see apps/web/i18n/default-locale.ts,
# apps/web/lib/pricing.ts) — what lets a separately deployed instance (e.g.
# a Spain deployment on its own project/domain) default to Spanish and show
# EUR pricing site-wide, without any app code change. Empty defaults
# reproduce this codebase's original pt-BR/BRL behavior exactly.

variable "default_locale" {
  description = "'pt', 'es', or 'en' — first-time-visitor default before any explicit NEXT_LOCALE cookie switch. Empty = 'pt'."
  type        = string
  default     = ""
}

variable "pricing_currency_symbol" {
  description = "Currency symbol shown on pricing displays, e.g. \"€\". Empty = \"R$\"."
  type        = string
  default     = ""
}

variable "pricing_currency_code" {
  description = "ISO currency code used for Intl currency formatting (dashboard billing, etc), e.g. \"EUR\". Empty = \"BRL\"."
  type        = string
  default     = ""
}

variable "pricing_amount_free" {
  type    = string
  default = ""
}

variable "pricing_amount_basico" {
  type    = string
  default = ""
}

variable "pricing_amount_whatsapp_proprio" {
  type    = string
  default = ""
}

variable "pricing_amount_integracao" {
  type    = string
  default = ""
}

# --- Cloud Run sizing (kept small on purpose — see ../../README.md#cost) --

variable "min_instances" {
  description = "Minimum Cloud Run instances for the web service. 0 = scale to zero between requests (cold start ~1-2s on Next.js standalone output)."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum Cloud Run instances for the web service."
  type        = number
  default     = 3
}

variable "cpu" {
  description = "vCPUs per Cloud Run instance."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory per Cloud Run instance."
  type        = string
  default     = "512Mi"
}

# --- Cloud SQL -----------------------------------------------------------

variable "db_tier" {
  description = <<-EOT
    Cloud SQL machine tier. db-f1-micro is the cheapest Postgres-capable tier
    (shared vCPU, ~25 connection limit, no HA) — fine for staging/low-traffic,
    not for real production load. Upgrade to a db-custom-N-N tier (or
    db-perf-optimized-N-N) for production once traffic justifies it.
  EOT
  type    = string
  default = "db-f1-micro"
}

variable "db_availability_type" {
  description = "ZONAL (single zone, cheaper) or REGIONAL (HA standby, ~2x cost). Start ZONAL, consider REGIONAL for production."
  type        = string
  default     = "ZONAL"
}

variable "db_disk_size_gb" {
  description = "Cloud SQL disk size in GB. Autoresize is on, this is only the starting size."
  type        = number
  default     = 10
}

variable "postgres_version" {
  description = "Cloud SQL Postgres major version."
  type        = string
  default     = "POSTGRES_16"
}

variable "db_deletion_protection" {
  description = "Set false only when you actually intend to `terraform destroy` the database. Leave true for production always."
  type        = bool
  default     = true
}
