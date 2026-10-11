---
title: Authenticate with the Nx Cloud Public API
description: Authenticate Nx Cloud Public API requests with a CI access token or a personal access token and Nx Cloud Id.
filter: 'type:Guides'
topics:
  - 'Nx Cloud'
  - 'Continuous integration'
---

Use one of these two options to authenticate a Public API request:

- A CI access token, sent as a bearer token.
- A personal access token (PAT) and Nx Cloud Id, sent together in two headers.

The Nx Cloud Id alone does not authenticate a Public API request.
Service-account credentials for the Prometheus metrics API do not authenticate Public API requests.

## Check plan eligibility

Public API access requires a Team, Enterprise, or OSS plan for the workspace's organization.
Free, Pro, and Legacy plans do not include Public API access.
The organization must be enabled, and your credential must have access to the workspace.

A request from an unsupported plan returns `403` with the error code `plan_not_allowed`.
Check the organization's plan before replacing a valid token or retrying the request.

## Choose your API host

Use the host that serves your workspace:

- `https://cloud.nx.app` for the US region.
- `https://eu.nx.app` for the EU region.
- Your deployment URL for a single-tenant installation.

The examples below require `curl` and `jq`.
They discover the CI pipeline execution (CIPE) collection path from your deployment, so they do not
assume an API version.

```shell
export NX_CLOUD_HOST="https://cloud.nx.app"

curl --fail --silent --show-error \
  "$NX_CLOUD_HOST/nx-cloud/data/openapi.json" \
  --output openapi.json

CIPES_PATH=$(jq -r '.paths | keys[] | select(endswith("/cipes"))' openapi.json)
```

## Use a CI access token

Create a CI access token in your Nx Cloud workspace settings, under **Access Control**.
See [CI access tokens](/docs/kb/access-tokens) for token management.

Store the token in your secret manager.
Provide it to your shell or CI environment as `NX_CLOUD_ACCESS_TOKEN`.

Send the token in the `Authorization` header:

```shell
curl --fail-with-body --silent --show-error --get \
  "$NX_CLOUD_HOST$CIPES_PATH" \
  --header "Authorization: Bearer $NX_CLOUD_ACCESS_TOKEN" \
  --data-urlencode "limit=10"
```

The token identifies its workspace.
This option does not require an `Nx-Cloud-Id` header.

## Use a personal access token and Nx Cloud Id

Create a PAT in your Nx Cloud **Profile** settings, under **Personal access tokens**.
You can also provision one through `nx login`.
See [personal access tokens](/docs/kb/personal-access-tokens) for token management.

Store the PAT in your secret manager.
Provide it to your shell or CI environment as `NX_CLOUD_PERSONAL_ACCESS_TOKEN`.

Find the Nx Cloud Id in the `nxCloudId` property of your workspace's `nx.json`, or in the workspace's
**General** settings.
Set `NX_CLOUD_WORKSPACE_ID` to that value:

```shell
export NX_CLOUD_WORKSPACE_ID="<nx-cloud-id>"
```

Send both headers in the same request:

```shell
curl --fail-with-body --silent --show-error --get \
  "$NX_CLOUD_HOST$CIPES_PATH" \
  --header "Nx-Cloud-Personal-Access-Token: $NX_CLOUD_PERSONAL_ACCESS_TOKEN" \
  --header "Nx-Cloud-Id: $NX_CLOUD_WORKSPACE_ID" \
  --data-urlencode "limit=10"
```

The PAT and Nx Cloud Id are required together.
Use these two headers instead of the CI bearer header.

## Keep credentials secure

Do not commit tokens to your repository or include them in logs, prompts, or reports.
Send credentials only to your Nx Cloud API host.
Do not forward them to signed asset-download URLs.

If a request returns `401`, check the token and its header.
For PAT authentication, check that both the PAT and Nx Cloud Id headers are present.

See [Query the Nx Cloud Public API](/docs/kb/query-public-api) for filters, pagination, and asset downloads.
Use the [API reference](/docs/reference/nx-cloud/public-api) to look up endpoints, response schemas, and errors.
