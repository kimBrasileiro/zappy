terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Local state by default so `terraform init` works with zero setup. Move
  # this to a GCS backend before more than one person touches this — see
  # README.md#remote-state.
  # backend "gcs" {
  #   bucket = "zappy-terraform-state"
  #   prefix = "prod"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Every resource below depends on one of these being on. Declared once here
# instead of scattered per-file so `terraform apply` on a brand-new project
# enables them in one pass instead of failing 4 times in a row.
locals {
  required_apis = [
    "run.googleapis.com",               # Cloud Run (web service + migration job)
    "sqladmin.googleapis.com",          # Cloud SQL
    "artifactregistry.googleapis.com",  # container image storage
    "secretmanager.googleapis.com",     # runtime secrets for Cloud Run
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
