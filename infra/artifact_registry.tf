resource "google_artifact_registry_repository" "images" {
  depends_on = [google_project_service.apis]

  location      = var.region
  repository_id = var.app_name
  format        = "DOCKER"
  description   = "Container images for the ${var.app_name} web app (built from apps/web/Dockerfile)."

  # Keeps the registry from growing unbounded across every build — untagged
  # images (superseded by a newer push to the same tag) older than 30 days
  # get pruned. Anything still tagged/referenced by a Cloud Run revision is
  # never touched by this policy.
  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s" # 30 days
    }
  }
}
