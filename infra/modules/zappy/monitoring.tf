# System health alerting — an external Uptime Check against /api/health
# (apps/web/app/api/health/route.ts, which itself now does a real `SELECT 1`
# against Cloud SQL, not just a static 200), plus alert policies for the
# other two real failure modes that check alone wouldn't distinguish: the
# database going down specifically (its own metric, so "Cloud SQL is down"
# reads as that in the alert email, not just "site is down") and the app
# throwing a burst of 5xx responses while still technically answering
# healthchecks. All three notify the same email — see var.alert_email.
#
# Skipped entirely during the very first bootstrap apply (see
# container_image's own comment on the chicken-and-egg app_url problem):
# an empty app_url means there's no real hostname yet to point an uptime
# check at.

resource "google_monitoring_notification_channel" "alert_email" {
  count = var.app_url != "" ? 1 : 0

  depends_on   = [google_project_service.apis]
  project      = var.project_id
  display_name = "${local.name}-alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_uptime_check_config" "web_health" {
  count = var.app_url != "" ? 1 : 0

  project      = var.project_id
  display_name = "${local.name}-web-health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(trimprefix(var.app_url, "https://"), "http://")
    }
  }
}

resource "google_monitoring_alert_policy" "web_down" {
  count = var.app_url != "" ? 1 : 0

  project      = var.project_id
  display_name = "${local.name}: site fora do ar (/api/health)"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failing"
    condition_threshold {
      filter          = "resource.type=\"uptime_url\" AND metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.web_health[0].uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      # An uptime check runs from ~6 global locations independently — a
      # threshold of 1 (not 0) means at least 2 locations have to agree it's
      # down before this fires, so one region's transient network blip
      # doesn't page for a non-outage. ALIGN_NEXT_OLDER (raw boolean, no
      # DOUBLE conversion) + REDUCE_COUNT_FALSE (count of failing locations)
      # is Google's own documented combination for uptime-check alerting.
      threshold_value = 1
      duration        = "60s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.host"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.alert_email[0].id]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "O healthcheck público (/api/health) parou de responder 200 — verifique o serviço Cloud Run e o Cloud SQL de ${local.name}."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "cloud_sql_down" {
  count = var.app_url != "" ? 1 : 0

  project      = var.project_id
  display_name = "${local.name}: Cloud SQL fora do ar"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL instance down"
    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND resource.label.\"database_id\"=\"${var.project_id}:${google_sql_database_instance.main.name}\" AND metric.type=\"cloudsql.googleapis.com/database/up\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "180s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MIN"
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.alert_email[0].id]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "A instância Cloud SQL de ${local.name} (${google_sql_database_instance.main.name}) está reportando \"down\" — todo booking/conversa/painel fica indisponível até voltar."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "cloud_run_error_burst" {
  count = var.app_url != "" ? 1 : 0

  project      = var.project_id
  display_name = "${local.name}: erros 5xx em rajada"
  combiner     = "OR"

  conditions {
    display_name = "Elevated 5xx rate on the web service"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"${google_cloud_run_v2_service.web.name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.\"response_code_class\"=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.alert_email[0].id]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "O serviço ${local.name} (Cloud Run) respondeu mais de 5 erros 5xx em 5 minutos — provavelmente algo quebrado no app, não só lentidão."
    mime_type = "text/markdown"
  }
}
