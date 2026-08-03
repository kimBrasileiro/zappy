locals {
  # Empty values filtered out so an unset optional var (e.g. no WhatsApp
  # number configured yet) doesn't ship as an empty-string env var — the
  # app's own `?? fallback` / `if (!x)` checks (see lib/stripe/client.ts#
  # isStripeConfigured, lib/whatsapp) already assume "unset", not "set to
  # empty string".
  plain_env = {
    for k, v in {
      NODE_ENV                           = "production"
      NEXT_PUBLIC_APP_URL                = var.app_url
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = var.stripe_publishable_key
      GOOGLE_CLIENT_ID                   = var.google_client_id
      GOOGLE_CALENDAR_CLIENT_ID          = var.google_calendar_client_id
      RESEND_FROM_EMAIL                  = var.resend_from_email
      WHATSAPP_CLOUD_API_PHONE_NUMBER_ID = var.whatsapp_phone_number_id
      WHATSAPP_CLOUD_API_NUMBER          = var.whatsapp_number
      WHATSAPP_DEFAULT_COUNTRY_CODE      = var.whatsapp_default_country_code
      DEFAULT_LOCALE                     = var.default_locale
      PRICING_CURRENCY_SYMBOL            = var.pricing_currency_symbol
      PRICING_CURRENCY_CODE              = var.pricing_currency_code
      PRICING_AMOUNT_FREE                = var.pricing_amount_free
      PRICING_AMOUNT_BASICO              = var.pricing_amount_basico
      PRICING_AMOUNT_WHATSAPP_PROPRIO    = var.pricing_amount_whatsapp_proprio
      PRICING_AMOUNT_INTEGRACAO          = var.pricing_amount_integracao
    } : k => v if v != ""
  }
}

resource "google_cloud_run_v2_service" "web" {
  depends_on = [google_project_service.apis]

  name     = "${local.name}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # The provider defaults this to true — appropriate for Cloud SQL (where
  # the actual data lives, see cloud_sql.tf) but not here: this resource is
  # just a stateless service definition, trivially recreated from this same
  # config, so protecting it from replacement only gets in the way (e.g.
  # blocking Terraform from fixing a revision stuck from a prior failed
  # apply, which is exactly what this override was added for).
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        # Only bill for CPU while handling a request — matches the "scale to
        # zero between requests" story from min_instances = 0. Flip to false
        # if this ever needs to run background work (e.g. BullMQ jobs)
        # inside the same container instead of a separate service.
        cpu_idle = true
      }

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = local.runtime_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime[env.key].secret_id
              version = "latest"
            }
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 0
        period_seconds        = 3
        failure_threshold     = 10
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    # Deploys pushed by the deploy-staging/deploy-production GitHub Actions
    # workflow (or infra/deploy.sh run by hand) move the live image out from
    # under whatever var.container_image was at the last `terraform apply`
    # — without this, the next unrelated `terraform apply` (e.g. bumping
    # max_instances) would silently roll the service back to that stale
    # image.
    ignore_changes = [template[0].containers[0].image]
  }
}

# Lets anyone hit the service without a Google identity token — this is a
# public multi-tenant web app (signup, widget, WhatsApp webhook), not an
# internal tool. Company-level auth happens inside the app itself.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.web.name
  location = google_cloud_run_v2_service.web.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
