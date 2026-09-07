resource "google_artifact_registry_repository" "images" {
  depends_on = [google_project_service.apis]

  location      = var.region
  repository_id = local.name
  format        = "DOCKER"
  description   = "Container images for the ${local.name} web app (built from apps/web/Dockerfile)."

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

  # infra/deploy.sh (and CI) tag every push with a unique timestamp
  # (web:20260903-112239, web:build-20260903-112239) on top of web:latest/
  # build-latest — so nothing is ever "untagged" and the policy above alone
  # never fires. This pair does the real pruning: keep-recent-tagged
  # unconditionally protects the newest 20 versions (each deploy produces 2
  # digests — runner + build stage — so that's ~10 deploys of rollback
  # headroom), and delete-old-tagged removes anything TAGGED older than 30
  # days that falls outside that protected set. A version currently
  # referenced by a live Cloud Run revision is never actually in danger
  # either way — Cloud Run pins the exact digest at deploy time, so an old
  # tag being deleted later doesn't affect what's already running.
  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 20
    }
  }
  cleanup_policies {
    id     = "delete-old-tagged"
    action = "DELETE"
    condition {
      tag_state  = "TAGGED"
      older_than = "2592000s" # 30 days
    }
  }
}
