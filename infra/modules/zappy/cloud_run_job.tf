# Not run automatically — Cloud Run Jobs don't have a "run on deploy" hook.
# The deploy-staging/deploy-production GitHub Actions workflow executes it
# as a step before rolling out the web service (same order infra/deploy.sh
# uses for manual deploys).
resource "google_cloud_run_v2_job" "migrate" {
  depends_on = [google_project_service.apis]

  name     = "${local.name}-migrate"
  location = var.region

  template {
    template {
      service_account = google_service_account.runtime.email
      # Prisma's own retry/timeout handles transient connection issues; a
      # Cloud Run-level retry would just re-run migrations that already
      # partially applied.
      max_retries = 0
      timeout     = "300s"

      containers {
        image = var.migration_image
        # apps/web/Dockerfile's `build` stage command reference (see the
        # comment above its `runner` stage).
        command = ["pnpm", "--filter", "@zappy/db", "db:migrate:prod"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
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

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }
    }
  }

  lifecycle {
    # Same reasoning as google_cloud_run_v2_service.web above — this job's
    # image is meant to be bumped right before each deploy by CI, not via
    # `terraform apply`.
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}
