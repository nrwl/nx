---
title: Scrape Prometheus metrics from Nx Cloud
description: Scrape workspace-level Prometheus metrics from a single-tenant Nx Cloud instance with Grafana Alloy or Prometheus, and manage the service account credentials.
filter: 'type:Guides'
topics:
  - 'Nx Cloud'
---

{% aside type="caution" title="Nx Enterprise" %}
Workspace metrics are available for hosted [Nx Cloud single-tenant deployments](/docs/enterprise/single-tenant/overview).
[Contact the Nx team](https://nx.dev/enterprise) to add them to your deployment.
{% /aside %}

Single-tenant Nx Cloud instances expose workspace-level metrics in the Prometheus exposition
format.
You can scrape the endpoint with Prometheus, Grafana Agent, Alloy, Datadog, or any other
compatible scraper.

- **Endpoint:** `GET /nx-cloud/external/metrics/v1/workspaces/<workspace-id>`
- **Auth:** HTTP Basic, where the username is the service account `clientId` and the password is
  the `secret`
- **Required scope:** `org:<org-id>:workspaces:<workspace-id>:metrics:read` (a wildcard
  `workspaces:*:metrics:read` is also accepted)
- **Response format:** `text/plain; version=0.0.4; charset=utf-8`, the Prometheus exposition
  format

## Get your service account

The Nx team enables the metrics endpoint on your instance and creates the initial service account
for you.
Contact your developer productivity engineer to kick this off.
You'll receive the following credentials out-of-band:

- A `clientId` in the format `nx-sa_xxxxxxxxxxxxxxxxxxxxx`
- A plaintext `secret` in the format `nx-sask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- The `workspaceId` whose metrics you want to scrape

Store the `clientId` and `secret` in your secret manager or a Kubernetes Secret.

{% aside type="caution" title="The secret is shown only once" %}
The plaintext secret can't be retrieved again after it's issued.
If you lose it, rotate the credentials as described in [Manage credentials](#manage-credentials).
{% /aside %}

The `curl` examples below are meant for exercising or debugging the API from a local shell.
Your scraper doesn't use these variables, it reads the credentials from a secret as shown in the
scraper configurations below.
To copy-paste the examples as-is, set these environment variables first:

```shell
export CLIENT_ID="nx-sa_xxxxxxxxxxxxxxxxxxxxx"
export SECRET="nx-sask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export WORKSPACE_ID="<workspace-id>"
export NX_CLOUD_HOST="https://<your-domain>.nx.app"
```

## Scrape the metrics endpoint

Verify the credentials work with a quick `curl` check:

```shell
curl -X GET "${NX_CLOUD_HOST}/nx-cloud/external/metrics/v1/workspaces/${WORKSPACE_ID}" \
  -u "${CLIENT_ID}:${SECRET}"
```

A successful response returns `text/plain` in the Prometheus exposition format:

```plaintext
# HELP nxcloud_metrics_generated_timestamp_seconds Unix timestamp when metrics were last computed
# TYPE nxcloud_metrics_generated_timestamp_seconds gauge
nxcloud_metrics_generated_timestamp_seconds 1.7456e+09
# HELP nxcloud_task_runs Task executions from most recent metrics window (CI only)
# TYPE nxcloud_task_runs gauge
nxcloud_task_runs{project="my-app",target="build",configuration="production"} 482
...
```

<!-- vale Nx.Headings = NO -->

### Grafana Alloy

<!-- vale Nx.Headings = YES -->

```plaintext
remote.kubernetes.secret "nxcloud_metrics" {
  name      = "nxcloud-metrics-access-token"
  namespace = "monitoring"
}

prometheus.scrape "nxcloud_workspace_metrics" {
  targets = [
    {
      "__address__"      = "<your-domain>.nx.app",
      "__metrics_path__" = "/nx-cloud/external/metrics/v1/workspaces/<workspace-id>",
      "__scheme__"       = "https",
    },
  ]

  basic_auth {
    username = nonsensitive(remote.kubernetes.secret.nxcloud_metrics.data["client_id"])
    password = nonsensitive(remote.kubernetes.secret.nxcloud_metrics.data["client_secret"])
  }

  forward_to      = [prometheus.remote_write.hostedmetrics.receiver]
  scrape_interval = "24h"
}
```

The referenced Kubernetes Secret contains the service account credentials under the `client_id`
and `client_secret` keys:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nxcloud-metrics-access-token
  namespace: monitoring
type: Opaque
stringData:
  client_id: nx-sa_xxxxxxxxxxxxxxxxxxxxx
  client_secret: nx-sask_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Prometheus

```yaml
scrape_configs:
  - job_name: nxcloud_workspace_metrics
    scrape_interval: 1h
    metrics_path: /nx-cloud/external/metrics/v1/workspaces/<workspace-id>
    scheme: https
    static_configs:
      - targets: ['<your-domain>.nx.app']
    basic_auth:
      username: nx-sa_xxxxxxxxxxxxxxxxxxxxx
      password_file: /etc/prometheus/nxcloud_secret
```

### Scrape interval

The metrics aggregate workspace-level counters and don't require high-resolution scraping.
By default, the instance produces daily metrics, so set your scrape interval to a similar period.
If you'd like more granular metrics, ask your developer productivity engineer to adjust the
generation interval.

## Available metrics

All values are computed from CI task runs only.
Local runs and `nx-cloud start-agent` runs are excluded.

### Metadata

| Metric                                        | Type  | Description                                                   | Labels |
| --------------------------------------------- | ----- | ------------------------------------------------------------- | ------ |
| `nxcloud_metrics_generated_timestamp_seconds` | gauge | Unix timestamp when the current metrics snapshot was computed | None   |

### Task run counts

| Metric              | Type  | Description                                                 | Labels                               |
| ------------------- | ----- | ----------------------------------------------------------- | ------------------------------------ |
| `nxcloud_task_runs` | gauge | Number of task executions in the most recent metrics window | `project`, `target`, `configuration` |

### Task durations

Duration values are in seconds.
The emitted quantiles are `0.5`, `0.9`, `0.95`, and `0.99`.

| Metric                                | Type  | Description                                                    | Labels                                           |
| ------------------------------------- | ----- | -------------------------------------------------------------- | ------------------------------------------------ |
| `nxcloud_task_duration_seconds`       | gauge | Task duration at the given quantile                            | `project`, `target`, `configuration`, `quantile` |
| `nxcloud_task_duration_seconds_sum`   | gauge | Total sum of task durations in the window                      | `project`, `target`, `configuration`             |
| `nxcloud_task_duration_seconds_count` | gauge | Number of task executions contributing to the duration summary | `project`, `target`, `configuration`             |

<!-- vale Nx.Headings = NO -->

### Top-N selection

<!-- vale Nx.Headings = YES -->

To keep the response size bounded, only the top tasks are emitted, ranked by run count and by
total wall time.
The default is 100 of each.
The Nx team can adjust this limit for your instance.

## Manage credentials

All credential management goes through the Nx Cloud External API, which uses the same HTTP Basic
authentication as the metrics endpoint.
The base path is `/nx-cloud/external`.

### View your service account

```shell
curl -X GET "${NX_CLOUD_HOST}/nx-cloud/external/service-accounts/v1/accounts/${CLIENT_ID}" \
  -u "${CLIENT_ID}:${SECRET}"
```

Response (`200 OK`):

```json
{
  "clientId": "nx-sa_xxxxxxxxxxxxxxxxxxxxx",
  "name": "Prometheus Metrics Service Account",
  "description": "Used by Grafana Alloy to scrape workspace metrics",
  "scopes": ["org:<org-id>:workspaces:<workspace-id>:metrics:read"],
  "status": "ACTIVE",
  "createdAt": "2026-04-15T10:30:00Z"
}
```

### List secrets

```shell
curl -X GET "${NX_CLOUD_HOST}/nx-cloud/external/service-accounts/v1/accounts/${CLIENT_ID}/secrets" \
  -u "${CLIENT_ID}:${SECRET}"
```

Response (`200 OK`):

```json
{
  "secrets": [
    {
      "secretId": "507f1f77bcf86cd799439011",
      "secretPrefix": "nx-sask_ab123",
      "type": "STATIC",
      "status": "ACTIVE",
      "expiresAt": "2026-07-14T10:30:00Z",
      "createdAt": "2026-04-15T10:30:00Z",
      "lastUsedAt": "2026-04-16T14:22:00Z"
    }
  ]
}
```

### Rotate with a grace period (recommended)

Once you have the initial credentials, you can rotate them yourself at any time.
Rotating with a grace period lets you update your scrapers without downtime, because both the old
and new secrets authenticate successfully until the grace period ends.

```shell
curl -X POST "${NX_CLOUD_HOST}/nx-cloud/external/service-accounts/v1/accounts/${CLIENT_ID}/secrets/rotate" \
  -u "${CLIENT_ID}:${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentSecretPrefix": "nx-sask_ab123",
    "gracePeriodHours": 24,
    "newExpiresInDays": 90
  }'
```

Response (`201 Created`):

```json
{
  "secretId": "507f1f77bcf86cd799439022",
  "secret": "nx-sask_newSecretReturnedOnlyOnce...",
  "secretPrefix": "nx-sask_newpr",
  "type": "STATIC",
  "status": "ACTIVE",
  "expiresAt": "2026-07-14T10:30:00Z",
  "createdAt": "2026-04-15T10:30:00Z",
  "rotatedFromSecretPrefix": "nx-sask_ab123"
}
```

{% aside type="caution" title="Save the new secret now" %}
Like the initial secret, the `secret` value in this response is shown only once.
{% /aside %}

A typical rotation flow looks like this:

1. Call the rotate endpoint and capture the new `secret`.
1. Update your Kubernetes Secret (`nxcloud-metrics-access-token`) with the new `client_secret`.
1. Wait for Alloy or Prometheus to pick up the updated Secret.
1. Verify the new secret works against the metrics endpoint.
1. Optionally, list the secrets to confirm both exist during the grace period and to see when the
   old one will auto-revoke.

The old secret is auto-revoked at `gracePeriodEndsAt`.
This field is only visible on the list-secrets response, not on the rotate response:

```json
{
  "secrets": [
    {
      "secretId": "507f1f77bcf86cd799439022",
      "secretPrefix": "nx-sask_newpr",
      "type": "STATIC",
      "status": "ACTIVE",
      "expiresAt": "2026-07-14T10:30:00Z",
      "createdAt": "2026-04-15T10:30:00Z"
    },
    {
      "secretId": "507f1f77bcf86cd799439011",
      "secretPrefix": "nx-sask_ab123",
      "type": "STATIC",
      "status": "PENDING_ROTATION",
      "gracePeriodEndsAt": "2026-04-16T10:30:00Z",
      "createdAt": "2026-04-14T10:30:00Z"
    }
  ]
}
```

### Rotate immediately

To rotate without a grace period, pass `gracePeriodHours: 0` and confirm the immediate
revocation:

```shell
curl -X POST "${NX_CLOUD_HOST}/nx-cloud/external/service-accounts/v1/accounts/${CLIENT_ID}/secrets/rotate" \
  -u "${CLIENT_ID}:${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentSecretPrefix": "nx-sask_ab123",
    "gracePeriodHours": 0,
    "confirmImmediateRevocation": true,
    "newExpiresInDays": 90
  }'
```

The old secret is revoked the moment this call succeeds.
Scrapers using the old secret will start failing with `401 Unauthorized` immediately.

### Revoke all secrets

Use this if you suspect a secret has been leaked.
After this call, the service account has no usable credentials, and the Nx team will need to
issue a new secret out-of-band.

```shell
curl -X POST "${NX_CLOUD_HOST}/nx-cloud/external/service-accounts/v1/accounts/${CLIENT_ID}/secrets/revoke-all" \
  -u "${CLIENT_ID}:${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'"${CLIENT_ID}"'",
    "confirmRevocation": true,
    "reason": "Security incident - suspected secret compromise"
  }'
```

Response (`200 OK`):

```json
{ "revokedCount": 1 }
```

## Error responses

| Status | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| 400    | Bad request, invalid workspace ID or parameters                |
| 401    | Authentication failed, invalid `clientId` or `secret`          |
| 403    | Insufficient scopes, missing `metrics:read` for this workspace |
| 404    | Workspace not found, or the metrics feature is not enabled     |
| 409    | Secret state prevents the requested operation                  |
| 412    | Missing confirmation for a destructive rotation                |
| 500    | Internal server error                                          |

Example error body:

```json
{
  "error": "Unauthorized",
  "message": "Invalid credentials",
  "traceId": "abc123"
}
```
