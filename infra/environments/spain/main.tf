terraform {
  required_version = ">= 1.7.0"

  # Local state works solo but two people (or a person + CI) applying
  # against the same environment will clobber each other's state — switch
  # to this before that happens (see ../../README.md#remote-state):
  # backend "gcs" {
  #   bucket = "your-project-id-terraform-state"
  #   prefix = "spain"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "zappy" {
  source = "../../modules/zappy"

  project_id  = var.project_id
  region      = var.region
  environment = "production"
  github_repo = var.github_repo

  container_image = var.container_image
  migration_image = var.migration_image

  app_url                   = var.app_url
  stripe_publishable_key    = var.stripe_publishable_key
  google_client_id          = var.google_client_id
  google_calendar_client_id = var.google_calendar_client_id
  resend_from_email         = var.resend_from_email
  whatsapp_phone_number_id      = var.whatsapp_phone_number_id
  whatsapp_number               = var.whatsapp_number
  whatsapp_default_country_code = var.whatsapp_default_country_code

  default_locale                  = var.default_locale
  pricing_currency_symbol         = var.pricing_currency_symbol
  pricing_currency_code           = var.pricing_currency_code
  pricing_amount_free             = var.pricing_amount_free
  pricing_amount_basico           = var.pricing_amount_basico
  pricing_amount_whatsapp_proprio = var.pricing_amount_whatsapp_proprio
  pricing_amount_integracao       = var.pricing_amount_integracao

  min_instances = var.min_instances
  max_instances = var.max_instances

  db_tier                = var.db_tier
  db_availability_type   = var.db_availability_type
  db_disk_size_gb        = var.db_disk_size_gb
  db_deletion_protection = var.db_deletion_protection
}
