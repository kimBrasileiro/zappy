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

    # GCP-API-level delete guard — distinct from the resource-level
    # `deletion_protection` above (that one only stops Terraform itself from
    # destroying this resource; this one stops a direct `gcloud sql instances
    # delete` or a console click too). Same variable drives both since there's
    # no real reason to want one without the other.
    deletion_protection_enabled = var.db_deletion_protection

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    # REQUIRED (not the default NOT_REQUIRED) closes the one real gap a
    # public IP + empty authorized_networks still leaves open: without this,
    # a leaked DATABASE_URL alone is enough for a direct plaintext psql
    # connection over the public IP — no need to also compromise IAM/the
    # proxy. REQUIRED forces every connection, including Cloud Run's and the
    # cloud-sql-proxy used for local access (see ../../README.md#connecting-
    # locally), through the IAM-authenticated Cloud SQL Auth Proxy, which
    # already covers both paths today — nothing about that changes.
    connector_enforcement = "REQUIRED"

    # No VPC connector / private IP on purpose — keeps this stack to exactly
    # the 3 billable always-on-ish pieces (Cloud SQL, Artifact Registry
    # storage, Secret Manager) instead of adding a Serverless VPC Connector
    # (its own hourly cost) just to reach the DB. Cloud Run talks to Cloud
    # SQL over the private Cloud SQL Auth Proxy socket Google manages for it
    # (see cloud_run.tf's volumes.cloud_sql_instance) — that path never
    # touches the public internet even though "ipv4_enabled" is on below.
    ip_configuration {
      ipv4_enabled = true
      # ENCRYPTED_ONLY closes the same gap as connector_enforcement above
      # from the other side — even a direct connection that somehow bypassed
      # the proxy would still have to negotiate TLS, not plaintext.
      ssl_mode = "ENCRYPTED_ONLY"
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
