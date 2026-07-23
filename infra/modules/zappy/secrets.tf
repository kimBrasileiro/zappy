# --- DATABASE_URL — the one secret Terraform can fill in itself, since it -
# already generated the password and knows the Cloud SQL connection name.
# Prisma talks to Cloud SQL over the Unix socket Cloud Run mounts for it
# (see cloud_run.tf), hence `host=/cloudsql/...` instead of a TCP host:port.
resource "google_secret_manager_secret" "database_url" {
  depends_on = [google_project_service.apis]
  secret_id  = "${local.name}-database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = format(
    "postgresql://%s:%s@localhost/%s?host=/cloudsql/%s&schema=public",
    google_sql_user.app.name,
    random_password.db.result,
    google_sql_database.app.name,
    google_sql_database_instance.main.connection_name,
  )
}

# --- Everything else — secret *containers* only. Terraform can't know your
# Stripe/Gemini/Resend/etc keys, so it just makes room for them. Populate
# real values after `terraform apply` (see ../../README.md step 4):
#   echo -n "sk_test_..." | gcloud secrets versions add zappy-staging-stripe-secret-key --data-file=-
# Cloud Run won't start until each of these has at least one version.
locals {
  # name (matches .env.example) -> Secret Manager secret_id suffix
  runtime_secrets = {
    BETTER_AUTH_SECRET            = "better-auth-secret"
    STRIPE_SECRET_KEY             = "stripe-secret-key"
    STRIPE_WEBHOOK_SECRET         = "stripe-webhook-secret"
    STRIPE_PRICE_BASICO           = "stripe-price-basico"
    STRIPE_PRICE_WHATSAPP_PROPRIO = "stripe-price-whatsapp-proprio"
    STRIPE_PRICE_INTEGRACAO       = "stripe-price-integracao"
    GEMINI_API_KEY                = "gemini-api-key"
    RESEND_API_KEY                = "resend-api-key"
    GOOGLE_CLIENT_SECRET          = "google-client-secret"
    WHATSAPP_CLOUD_API_TOKEN      = "whatsapp-cloud-api-token"
    META_APP_SECRET               = "meta-app-secret"
    META_WEBHOOK_VERIFY_TOKEN     = "meta-webhook-verify-token"
    WHATSAPP_TOKEN_ENCRYPTION_KEY = "whatsapp-token-encryption-key"
    CRON_SECRET                   = "cron-secret"
  }
}

resource "google_secret_manager_secret" "runtime" {
  for_each = local.runtime_secrets

  depends_on = [google_project_service.apis]
  secret_id  = "${local.name}-${each.value}"

  replication {
    auto {}
  }
}
