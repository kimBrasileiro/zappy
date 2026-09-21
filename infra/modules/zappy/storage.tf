# Service photos (dashboard/services — see lib/storage.ts#uploadServicePhoto).
# Public read: these images are shown on the PUBLIC booking form/page, not
# behind auth — same exposure level as apps/web/public/*.png static assets,
# just user-uploaded instead of build-time. project_id is folded into the
# name because GCS bucket names are globally unique across every GCP
# project, not just this one — "${local.name}-service-photos" alone risks
# colliding with an unrelated project somewhere else in the world.
resource "google_storage_bucket" "service_photos" {
  depends_on = [google_project_service.apis]

  name                        = "${var.project_id}-${local.name}-service-photos"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  cors {
    origin          = ["*"]
    method          = ["GET"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "service_photos_public_read" {
  bucket = google_storage_bucket.service_photos.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Lets the same runtime service account the web service already uses
# (iam.tf) write uploaded photos directly — no separate credentials to
# provision, same pattern as its existing Secret Manager access.
resource "google_storage_bucket_iam_member" "service_photos_runtime_write" {
  bucket = google_storage_bucket.service_photos.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}
