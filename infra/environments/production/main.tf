terraform {
  required_version = ">= 1.7.0"

  # Strongly recommended for production specifically — see
  # ../../README.md#remote-state. Uncomment once you've created the bucket:
  # backend "gcs" {
  #   bucket = "your-project-id-terraform-state"
  #   prefix = "production"
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
  alert_email = var.alert_email

  container_image = var.container_image
  migration_image = var.migration_image

  app_url                   = var.app_url
  stripe_publishable_key    = var.stripe_publishable_key
  google_client_id          = var.google_client_id
  google_calendar_client_id = var.google_calendar_client_id
  resend_from_email         = var.resend_from_email
  whatsapp_phone_number_id  = var.whatsapp_phone_number_id
  whatsapp_number           = var.whatsapp_number

  min_instances = var.min_instances
  max_instances = var.max_instances

  db_tier                = var.db_tier
  db_availability_type   = var.db_availability_type
  db_disk_size_gb        = var.db_disk_size_gb
  db_deletion_protection = var.db_deletion_protection
}
