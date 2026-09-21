# Fires api/cron/booking-reminders on the web service every 15 minutes — no
# separate Cloud Run Job needed (unlike migrate, this is just an HTTP call
# against the service that's already running). The route checks this same
# secret's value in the Authorization header (see that route.ts) before
# doing anything, so an unauthenticated caller just gets a 401.
#
# Reads CRON_SECRET's *current* value at apply time — this secret already
# has versions (populated the same manual way as every other runtime secret,
# see secrets.tf's own comment), so this only fails if it's ever emptied out
# entirely, same bootstrap ordering every other secret-dependent resource
# here already assumes.
data "google_secret_manager_secret_version" "cron_secret" {
  secret = google_secret_manager_secret.runtime["CRON_SECRET"].secret_id
}

resource "google_cloud_scheduler_job" "booking_reminders" {
  depends_on = [google_project_service.apis]

  name      = "${local.name}-booking-reminders"
  region    = var.region
  schedule  = "*/15 * * * *"
  time_zone = "UTC"

  http_target {
    uri         = "${var.app_url}/api/cron/booking-reminders"
    http_method = "POST"
    headers = {
      Authorization = "Bearer ${data.google_secret_manager_secret_version.cron_secret.secret_data}"
    }
  }

  retry_config {
    retry_count = 1
  }
}
