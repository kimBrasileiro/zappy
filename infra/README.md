# Zappy on GCP — Terraform

Deploys the `@zappy/web` app (apps/web) to **Cloud Run**, backed by **Cloud
SQL for PostgreSQL**, with images in **Artifact Registry** and secrets in
**Secret Manager**. Chosen specifically to be cheap and low
ops: Cloud Run scales to zero between requests, there's no Kubernetes
cluster/nodes to patch, and everything here is one `terraform apply` away
from existing or being torn down.

This replaces the previous AWS CDK stack (ECS/ALB/Aurora) — same shape
(container service + Postgres + migration task), different cloud.

## Architecture

```
                        ┌─────────────────────┐
  customer / browser ─▶ │  Cloud Run: web      │ ── secrets ──▶ Secret Manager
  WhatsApp webhook   ─▶ │  (apps/web, scales   │
  Stripe webhook     ─▶ │   0 → N instances)   │
                        └──────────┬───────────┘
                                   │ Cloud SQL Auth Proxy (unix socket,
                                   │ no VPC connector needed)
                                   ▼
                        ┌─────────────────────┐
                        │  Cloud SQL: Postgres │
                        └─────────────────────┘

                        ┌─────────────────────┐
                        │  Cloud Run Job:      │  run manually before each
                        │  migrate             │  deploy (prisma migrate
                        │  (build-stage image) │  deploy) — see deploy.sh
                        └─────────────────────┘

  Artifact Registry: stores both images (runner = web service,
  build = migration job, see apps/web/Dockerfile's two stages)
```

## Prerequisites

- A GCP project with billing enabled
- `gcloud` CLI, authenticated (`gcloud auth login`) with the project set (`gcloud config set project YOUR_PROJECT_ID`)
- `terraform` >= 1.7 ([download](https://developer.hashicorp.com/terraform/install))
- Docker (for building images)

## Step 1 — configure variables

```sh
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` — at minimum set `project_id`. Everything else has a
working default (see `variables.tf` for what each one does and
`README.md#cost` below for what to tune if cost is tight).

## Step 2 — init

```sh
terraform init
```

## Step 3 — bootstrap apply

```sh
terraform apply
```

On this **first** apply, `container_image`/`migration_image` are still the
placeholder default (a public Cloud Run hello-world image) — that's
intentional. This first apply's job is to create everything that doesn't
depend on your actual app image yet: Artifact Registry (so you have
somewhere to push to), Cloud SQL, the empty Secret Manager containers, IAM,
and a Cloud Run service/job that at least exist (running the placeholder).

## Step 4 — populate secrets

Terraform created the secret *containers* in step 3 but left them empty
(it can't know your Stripe/Gemini/Resend/etc keys) — Cloud Run won't
actually start successfully until each one has a version. Run
`terraform output secrets_to_populate` to see the exact list, then for each:

```sh
echo -n "sk_live_..." | gcloud secrets versions add zappy-stripe-secret-key --data-file=-
echo -n "whsec_..."   | gcloud secrets versions add zappy-stripe-webhook-secret --data-file=-
echo -n "price_..."   | gcloud secrets versions add zappy-stripe-price-basico --data-file=-
echo -n "price_..."   | gcloud secrets versions add zappy-stripe-price-whatsapp-proprio --data-file=-
echo -n "price_..."   | gcloud secrets versions add zappy-stripe-price-integracao --data-file=-
echo -n "AQ...."      | gcloud secrets versions add zappy-gemini-api-key --data-file=-
echo -n "re_...."     | gcloud secrets versions add zappy-resend-api-key --data-file=-
echo -n "GOCSPX-..."  | gcloud secrets versions add zappy-google-client-secret --data-file=-
# WhatsApp Cloud API / cron secret — optional, only if you're using those features yet:
echo -n "..." | gcloud secrets versions add zappy-whatsapp-cloud-api-token --data-file=-
echo -n "..." | gcloud secrets versions add zappy-meta-app-secret --data-file=-
echo -n "..." | gcloud secrets versions add zappy-meta-webhook-verify-token --data-file=-
echo -n "..." | gcloud secrets versions add zappy-whatsapp-token-encryption-key --data-file=-
echo -n "..." | gcloud secrets versions add zappy-cron-secret --data-file=-
```

`DATABASE_URL` needs none of this — Terraform generated the DB password
itself and already wrote the full connection string as a secret version
(see `secrets.tf`).

### Chicken-and-egg: `app_url` {#chicken-and-egg-app-url}

Next.js inlines every `NEXT_PUBLIC_*` var into the client JS bundle at
**build** time, not runtime — but the exact `*.run.app` URL for
`google_cloud_run_v2_service.web` is only assigned once that service exists.
Two ways to break the cycle:

- **Have a custom domain already** (recommended — see
  [Custom domain](#custom-domain) below): set `app_url` in
  `terraform.tfvars` to that domain up front, build the image with it from
  the start, never rebuild just because of this.
- **No custom domain yet**: run `terraform apply` once (step 3), read
  `terraform output cloud_run_url`, set that as `app_url` in
  `terraform.tfvars` and re-run `terraform apply` (cheap — only that one
  output-derived env var changes), then build the real image in step 5
  using that URL.

## Step 5 — build, push, migrate, deploy

The fastest path is the included script:

```sh
export NEXT_PUBLIC_APP_URL=https://app.suaempresa.com   # or the cloud_run_url output
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
./infra/deploy.sh YOUR_PROJECT_ID southamerica-east1
```

It builds both Docker stages (`runner` for the web service, `build` for the
migration job — see `apps/web/Dockerfile`), pushes them to Artifact
Registry, runs the migration job and **waits for it to succeed**, then
deploys the web service. If you'd rather run each step by hand, read
through `deploy.sh` — it's short and every command in it is copy-pasteable.

Re-run this same script for every future deploy. It never touches Terraform
state (see the `lifecycle.ignore_changes` in `cloud_run.tf`/
`cloud_run_job.tf`) — `terraform apply` stays reserved for actual
infrastructure changes (sizing, new secrets, etc), not routine deploys.

## Custom domain {#custom-domain}

Not included as a Terraform resource here (domain verification is an
interactive step in Google Search Console the first time). Once your domain
is verified in your GCP project:

```sh
gcloud run domain-mappings create --service zappy-web --domain app.suaempresa.com --region southamerica-east1
```

Then point your DNS at the records it prints, and set `app_url` /
rebuild per [Chicken-and-egg](#chicken-and-egg-app-url) above.

## Cost {#cost}

Everything here scales down except Cloud SQL, which is the one always-on
piece (Postgres needs a running instance to hold data — there's no
serverless-to-$0 managed Postgres option on GCP today):

| Resource | Default | Approx. cost |
|---|---|---|
| Cloud Run (web) | `min_instances=0`, 1 vCPU / 512Mi | $0 idle, pay per request while handling traffic |
| Cloud Run (migrate job) | runs on demand only | $0 idle, a few cents per deploy |
| Cloud SQL | `db-f1-micro`, ZONAL, 10GB | ~$9-15/mo (shared vCPU tier, no HA) |
| Artifact Registry | — | ~$0.10/GB/mo, pruned monthly (see `artifact_registry.tf`) |
| Secret Manager | ~15 secrets | ~$0.06/secret/mo + access calls, negligible |

Levers, in `terraform.tfvars`:
- `db_tier` — the biggest lever by far. `db-f1-micro` is the floor; anything
  bigger roughly doubles+ the Cloud SQL line.
- `min_instances` — keep at 0 unless cold starts (~1-2s on this Next.js
  standalone build) are unacceptable for your traffic pattern.
- `max_instances` — caps runaway cost from a traffic spike/abuse; 3 is a
  reasonable ceiling for a still-small customer base.

## Connecting locally (psql / Prisma Studio against the real DB) {#connecting-locally}

Cloud Run reaches Cloud SQL over a private path (the `/cloudsql` unix socket
volume in `cloud_run.tf`) that your laptop can't use directly. Use the
[Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy)
instead of the raw public IP:

```sh
cloud-sql-proxy $(terraform output -raw cloud_sql_connection_name) &

# Prints the full connection string Terraform generated — copy the password
# out of it (between `zappy_app:` and `@localhost`):
gcloud secrets versions access latest --secret=zappy-database-url

psql "host=127.0.0.1 port=5432 dbname=zappy user=zappy_app password=PASTE_PASSWORD_HERE"
```

## Remote state {#remote-state}

Local state (a `terraform.tfstate` file next to these `.tf` files, gitignored)
is fine solo. Before a second person runs `terraform apply` against this
same project, switch to a GCS backend so you don't clobber each other's
state:

```sh
gsutil mb -l southamerica-east1 gs://YOUR_PROJECT_ID-terraform-state
```

Then uncomment the `backend "gcs"` block in `main.tf`, fill in the bucket
name, and run `terraform init -migrate-state`.

## Files

| File | What's in it |
|---|---|
| `main.tf` | Provider, required APIs |
| `variables.tf` | Every input, with defaults and what each one costs/changes |
| `artifact_registry.tf` | Docker image repo |
| `cloud_sql.tf` | Postgres instance, database, app user |
| `secrets.tf` | Secret Manager containers (+ the one auto-filled: `DATABASE_URL`) |
| `iam.tf` | Runtime service account + least-privilege secret access |
| `cloud_run.tf` | The web service |
| `cloud_run_job.tf` | The migration job (`prisma migrate deploy`) |
| `outputs.tf` | URLs, connection names, the secret ids you still need to fill |
| `deploy.sh` | Build → push → migrate → deploy, for every deploy after the first |
