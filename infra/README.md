# Zappy on GCP — Terraform + CI/CD

Deploys `@zappy/web` (apps/web) to **Cloud Run**, backed by **Cloud SQL for
PostgreSQL**, images in **Artifact Registry**, secrets in **Secret
Manager** — as two fully isolated environments, **staging** and
**production**, each provisioned by the same reusable Terraform module and
deployed automatically by GitHub Actions:

- **Push to `main`** → deploys to **staging**, no approval needed.
- **Publish a GitHub Release** → deploys to **production** (optionally
  gated behind a manual approval — see [Production approval
  gate](#production-approval-gate)).

Chosen to be cheap and low ops: Cloud Run scales to zero between requests,
there's no Kubernetes cluster to patch, and GitHub Actions authenticates via
Workload Identity Federation — no service-account JSON key sitting in
repo secrets.

## Layout

```
infra/
  modules/zappy/          # everything that makes up one environment
                           # (Cloud Run, Cloud SQL, Artifact Registry,
                           # Secret Manager, IAM, Workload Identity
                           # Federation) — see modules/zappy/*.tf
  environments/
    staging/               # thin wrapper: module "zappy" { environment = "staging" ... }
    production/            # same, { environment = "production" }
  deploy.sh                # manual build→push→migrate→deploy, same steps CI runs

.github/workflows/
  deploy.yml               # the actual build→push→migrate→deploy steps (reusable)
  deploy-staging.yml       # trigger: push to main
  deploy-production.yml    # trigger: published release
```

Both environments are independent Terraform states, independent Cloud SQL
instances, independent secrets, independent CI credentials — a staging
mistake (bad migration, leaked test key, misconfigured secret) cannot touch
production. They *can* live in the same GCP project (resource names are
prefixed `zappy-staging-*` / `zappy-production-*`) or in two separate
projects for even stronger isolation — nothing in `modules/zappy` assumes
either way, it's just `project_id`.

## Prerequisites

- A GCP project with billing enabled (one, or two if you want separate
  projects per environment)
- `gcloud` CLI, authenticated (`gcloud auth login`)
- `terraform` >= 1.7 ([download](https://developer.hashicorp.com/terraform/install))
- Docker (for building images, locally or the same way CI does)
- Admin on the `kimBrasileiro/zappy` GitHub repo (to set Environment secrets/vars)

## Part 1 — provision staging

Terraform apply is a **human-run, local** step, deliberately not automated
via GitHub Actions — see [Why Terraform apply isn't in
CI](#why-terraform-apply-isnt-in-ci).

```sh
cd infra/environments/staging
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — at minimum set project_id
terraform init
terraform apply
```

Like the single-environment setup this replaced, `container_image` /
`migration_image` are left as the placeholder default on this first apply —
it only needs to create everything that doesn't depend on your actual app
image yet (Artifact Registry, Cloud SQL, empty secrets, IAM, WIF, and a
Cloud Run service/job that at least exist running the placeholder).

### Populate secrets

```sh
terraform output secrets_to_populate
```

For each one:

```sh
echo -n "sk_test_..." | gcloud secrets versions add zappy-staging-stripe-secret-key --data-file=-
echo -n "whsec_..."   | gcloud secrets versions add zappy-staging-stripe-webhook-secret --data-file=-
echo -n "price_..."   | gcloud secrets versions add zappy-staging-stripe-price-basico --data-file=-
echo -n "price_..."   | gcloud secrets versions add zappy-staging-stripe-price-whatsapp-proprio --data-file=-
echo -n "price_..."   | gcloud secrets versions add zappy-staging-stripe-price-integracao --data-file=-
echo -n "AQ...."      | gcloud secrets versions add zappy-staging-gemini-api-key --data-file=-
echo -n "re_...."     | gcloud secrets versions add zappy-staging-resend-api-key --data-file=-
echo -n "GOCSPX-..."  | gcloud secrets versions add zappy-staging-google-client-secret --data-file=-
# WhatsApp Cloud API / cron secret — optional, only if using those yet:
echo -n "..." | gcloud secrets versions add zappy-staging-whatsapp-cloud-api-token --data-file=-
echo -n "..." | gcloud secrets versions add zappy-staging-meta-app-secret --data-file=-
echo -n "..." | gcloud secrets versions add zappy-staging-meta-webhook-verify-token --data-file=-
echo -n "..." | gcloud secrets versions add zappy-staging-whatsapp-token-encryption-key --data-file=-
echo -n "..." | gcloud secrets versions add zappy-staging-cron-secret --data-file=-
```

`DATABASE_URL` needs none of this — Terraform generated the DB password
itself and already wrote the full connection string (see
`modules/zappy/secrets.tf`). Use **Stripe test-mode keys** (`sk_test_...`,
`price_...` from test-mode Products) for staging.

### Chicken-and-egg: `app_url` {#chicken-and-egg-app-url}

Next.js inlines every `NEXT_PUBLIC_*` var into the client bundle at
**build** time, not runtime — but the `*.run.app` URL is only assigned once
the Cloud Run service exists. Either set `app_url` to a custom domain you
already know you'll use (see [Custom domain](#custom-domain)), or apply
once, read `terraform output cloud_run_url`, set that as `app_url`, and
re-apply (cheap — only that one var changes) before building the real image.

### First real deploy

```sh
export NEXT_PUBLIC_APP_URL=https://staging.suaempresa.com   # or the cloud_run_url output
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
./infra/deploy.sh staging YOUR_PROJECT_ID southamerica-east1
```

## Part 2 — wire up GitHub Actions for staging

1. Get the CI identity Terraform just created:

   ```sh
   terraform output workload_identity_provider
   terraform output deployer_service_account
   ```

2. In GitHub: **Settings → Environments → New environment → `staging`**.

3. Add these **Environment secrets**:

   | Secret | Value |
   |---|---|
   | `WIF_PROVIDER` | the `workload_identity_provider` output |
   | `WIF_SERVICE_ACCOUNT` | the `deployer_service_account` output |
   | `GCP_PROJECT_ID` | your GCP project id |

4. Add these **Environment variables** (not secret, just non-default config):

   | Variable | Value |
   |---|---|
   | `GCP_REGION` | e.g. `southamerica-east1` (optional — defaults to that anyway) |
   | `APP_URL` | same value as `app_url` in terraform.tfvars |
   | `STRIPE_PUBLISHABLE_KEY` | same `pk_test_...` as terraform.tfvars |

That's it — push to `main` now deploys to staging automatically
(`.github/workflows/deploy-staging.yml`).

## Part 3 — provision production (whenever you're ready)

Identical to Part 1/2, in `infra/environments/production` and a `production`
GitHub Environment instead of `staging`. Two differences worth calling out:

- Use **live** Stripe keys (`sk_live_...`, `pk_live_...`, live-mode
  `price_...`) once you're actually ready to take real payments — not
  before.
- Set up the [production approval gate](#production-approval-gate) below —
  without it, publishing *any* GitHub Release deploys to production
  immediately, no human in the loop.

Production only ever deploys from a **published GitHub Release**
(`.github/workflows/deploy-production.yml`) — cut one from whatever commit
is currently on staging and has been verified there:

```sh
gh release create v1.0.0 --target main --generate-notes
```

### Production approval gate {#production-approval-gate}

GitHub Environments support required reviewers natively — no extra
Terraform/YAML needed:

**Settings → Environments → production → Required reviewers** → add
yourself (or your team). Every run of `deploy-production.yml` then pauses
at the `environment: production` step until someone approves it in the
Actions tab.

## Why Terraform apply isn't in CI {#why-terraform-apply-isnt-in-ci}

The GitHub Actions deploy identity (`modules/zappy/wif.tf`'s
`deployer` service account) is deliberately narrow — push images, roll out
a Cloud Run revision, execute the migration job. It cannot touch Cloud SQL
settings, IAM, or Secret Manager. That's what makes it safe to let a
workflow run unattended on every push to `main`.

Running `terraform apply` from CI would need a *much* more privileged
identity (one that can create/modify Cloud SQL instances, IAM bindings,
secrets — i.e. most of what a project owner can do), and that identity
would need its own bootstrapping story before it could exist. For a
project this size, the tradeoff isn't worth it yet: infra changes are
infrequent and deliberate, so running `terraform plan`/`apply` from your own
machine (with your own `gcloud auth login` credentials) and reviewing the
plan yourself is both simpler and safer than standing up a second,
more-privileged CI identity. Revisit this once infra changes become
frequent enough that the manual step is actually the bottleneck.

## Custom domain {#custom-domain}

Not a Terraform resource here (domain verification is an interactive step
in Google Search Console the first time). Once your domain is verified in
the relevant GCP project:

```sh
gcloud run domain-mappings create --service zappy-staging-web --domain staging.suaempresa.com --region southamerica-east1
# and separately, once you have it:
gcloud run domain-mappings create --service zappy-production-web --domain app.suaempresa.com --region southamerica-east1
```

Then point your DNS at the records it prints, and set `app_url` / rebuild
per [Chicken-and-egg](#chicken-and-egg-app-url) above.

## Cost {#cost}

Per environment. Running both staging and production roughly doubles this
— consider it the cost of never testing a migration against production data:

| Resource | Default | Approx. cost |
|---|---|---|
| Cloud Run (web) | `min_instances=0`, 1 vCPU / 512Mi | $0 idle, pay per request while handling traffic |
| Cloud Run (migrate job) | runs on demand only | $0 idle, a few cents per deploy |
| Cloud SQL | `db-f1-micro`, ZONAL, 10GB | ~$9-15/mo (shared vCPU tier, no HA) |
| Artifact Registry | — | ~$0.10/GB/mo, pruned monthly |
| Secret Manager | ~13 secrets | ~$0.06/secret/mo + access calls, negligible |
| Workload Identity Federation | — | $0 — no per-token or per-pool charge |

Levers, in each environment's `terraform.tfvars`:
- `db_tier` — the biggest lever by far.
- `min_instances` — keep at 0 on staging always; consider 1 on production
  once cold starts (~1-2s) actually bother real customers.
- `max_instances` — caps runaway cost from a traffic spike/abuse.

A cheaper option for staging specifically, if idle cost still matters: skip
Cloud SQL's `disk_autoresize`/backups tuning, or simply
`terraform destroy -target=module.zappy.google_sql_database_instance.main`
between test sessions and re-apply when you need it — staging's
`db_deletion_protection` defaults to `false` for exactly this.

## Connecting locally (psql / Prisma Studio against a real environment) {#connecting-locally}

Cloud Run reaches Cloud SQL over a private path (the `/cloudsql` unix socket
volume) your laptop can't use directly. Use the [Cloud SQL Auth
Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy):

```sh
cloud-sql-proxy $(cd infra/environments/staging && terraform output -raw cloud_sql_connection_name) &

# Prints the full connection string Terraform generated — copy the password
# out of it (between `zappy_app:` and `@localhost`):
gcloud secrets versions access latest --secret=zappy-staging-database-url

psql "host=127.0.0.1 port=5432 dbname=zappy user=zappy_app password=PASTE_PASSWORD_HERE"
```

Same commands with `production` swapped in — be careful which one you're
pointed at.

## Remote state {#remote-state}

Local state (a `terraform.tfstate` next to each environment's `.tf` files,
gitignored) is fine solo. Before a second person applies against these same
environments — or before you trust CI with a more-privileged identity down
the line — switch each environment to its own GCS backend:

```sh
gsutil mb -l southamerica-east1 gs://YOUR_PROJECT_ID-terraform-state
```

Then uncomment the `backend "gcs"` block in that environment's `main.tf`
(bucket name + a `prefix` unique per environment — already set to
`"staging"` / `"production"`), and run `terraform init -migrate-state`.

## Files

| File | What's in it |
|---|---|
| `modules/zappy/main.tf` | Required providers, enabled APIs |
| `modules/zappy/variables.tf` | Every input, with defaults and what each one costs/changes |
| `modules/zappy/artifact_registry.tf` | Docker image repo |
| `modules/zappy/cloud_sql.tf` | Postgres instance, database, app user |
| `modules/zappy/secrets.tf` | Secret Manager containers (+ the one auto-filled: `DATABASE_URL`) |
| `modules/zappy/iam.tf` | Runtime service account (Cloud Run itself) + least-privilege secret access |
| `modules/zappy/wif.tf` | Workload Identity Federation pool/provider + the separate, narrower deployer service account GitHub Actions impersonates |
| `modules/zappy/cloud_run.tf` | The web service |
| `modules/zappy/cloud_run_job.tf` | The migration job (`prisma migrate deploy`) |
| `modules/zappy/outputs.tf` | URLs, connection names, secret ids still needed, WIF provider/SA for GitHub |
| `environments/staging/`, `environments/production/` | Thin wrappers instantiating the module once each |
| `deploy.sh` | Manual build → push → migrate → deploy, mirrors what CI does |
| `../.github/workflows/deploy.yml` | The actual deploy steps (reusable workflow) |
| `../.github/workflows/deploy-staging.yml` | Trigger: push to `main` |
| `../.github/workflows/deploy-production.yml` | Trigger: published release |
