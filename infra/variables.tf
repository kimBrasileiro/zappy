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
  description = "Prefix used for every resource name (Cloud Run service, Artifact Registry repo, Cloud SQL instance, etc)."
  type        = string
  default     = "zappy"
}

# --- Container image ---------------------------------------------------

variable "container_image" {
  description = <<-EOT
    Full image reference to deploy for the web service, built from the
    `runner` stage of apps/web/Dockerfile, e.g.
    "southamerica-east1-docker.pkg.dev/PROJECT/zappy/web:latest".
    Left as the placeholder on the very first `terraform apply` (see README
    step 3) — Cloud Run then gets bootstrapped with a public hello-world
    image so the service exists and Artifact Registry has somewhere to push
    to; re-run `terraform apply` once you've pushed a real image.
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
    Public URL this app is served at, e.g. "https://app.suaempresa.com" or
    the Cloud Run default "https://zappy-web-xxxx.a.run.app". Baked into the
    client bundle at *build* time (Next.js inlines NEXT_PUBLIC_ vars) — see
    README#chicken-and-egg-app-url for the two-pass bootstrap this implies
    if you don't have a custom domain picked yet.
  EOT
  type    = string
  default = ""
}

variable "stripe_publishable_key" {
  description = "Stripe pk_live_/pk_test_... — not secret (it's shipped to the browser), but still build-time-only like app_url above."
  type        = string
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client id (public half of the credential pair; the secret half lives in Secret Manager)."
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

# --- Cloud Run sizing (kept small on purpose — see README#cost) --------

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
    (shared vCPU, ~25 connection limit, no HA) — fine for a starting/low-
    traffic setup, not for real production load. Upgrade to a db-custom-N-N
    tier (or db-perf-optimized-N-N) once traffic justifies it.
  EOT
  type    = string
  default = "db-f1-micro"
}

variable "db_availability_type" {
  description = "ZONAL (single zone, cheaper) or REGIONAL (HA standby, ~2x cost). Start ZONAL."
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
  description = "Set false only when you actually intend to `terraform destroy` the database."
  type        = bool
  default     = true
}
