# No `provider "google" {}` block here on purpose — a reusable child module
# should never configure providers itself (Terraform best practice), it just
# declares the versions it needs and inherits whatever the caller (see
# ../../environments/staging/main.tf and .../production/main.tf) configured.
terraform {
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
}

locals {
  # Every resource in this module is named off this, not var.app_name
  # directly — so one GCP project can hold a "zappy-staging" and a
  # "zappy-production" stack side by side (two calls to this module) without
  # a single name collision.
  name = "${var.app_name}-${var.environment}"

  required_apis = [
    "run.googleapis.com",              # Cloud Run (web service + migration job)
    "sqladmin.googleapis.com",         # Cloud SQL
    "artifactregistry.googleapis.com", # container image storage
    "secretmanager.googleapis.com",    # runtime secrets for Cloud Run
    "iam.googleapis.com",
    "iamcredentials.googleapis.com", # Workload Identity Federation token exchange (wif.tf)
    "sts.googleapis.com",            # ditto
    "cloudresourcemanager.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
