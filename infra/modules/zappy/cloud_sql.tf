# Generated once, stored only in Terraform state + Secret Manager (never in
# a .tf file or tfvars) — see secrets.tf#database_url.
resource "random_password" "db" {
  length  = 32
  special = false # keeps it URL-safe for the DATABASE_URL connection string
}

resource "google_sql_database_instance" "main" {
  depends_on = [google_project_service.apis]

  name             = "${local.name}-pg"
  region           = var.region
  database_version = var.postgres_version

  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    # New Cloud SQL instances default to the ENTERPRISE_PLUS edition, which
    # dropped support for the classic shared-core tiers (db-f1-micro,
    # db-g1-small) in favor of its own db-perf-optimized-N-* line —
    # explicit ENTERPRISE is what unlocks db-f1-micro as a valid tier again.
    edition           = "ENTERPRISE"
    availability_type = var.db_availability_type
    disk_size         = var.db_disk_size_gb
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    # No VPC connector / private IP on purpose — keeps this stack to exactly
    # the 3 billable always-on-ish pieces (Cloud SQL, Artifact Registry
    # storage, Secret Manager) instead of adding a Serverless VPC Connector
    # (its own hourly cost) just to reach the DB. Cloud Run talks to Cloud
    # SQL over the private Cloud SQL Auth Proxy socket Google manages for it
    # (see cloud_run.tf's volumes.cloud_sql_instance) — that path never
    # touches the public internet even though "ipv4_enabled" is on below.
    ip_configuration {
      ipv4_enabled = true
    }
  }
}

resource "google_sql_database" "app" {
  name     = var.app_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "${var.app_name}_app"
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}
