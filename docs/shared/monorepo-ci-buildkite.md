---
title: Configuring CI Using Buildkite and Nx
description: Learn how to set up Buildkite for your Nx workspace to run affected commands, retrieve previous successful builds, and optimize CI performance.
---

# Configuring CI Using Buildkite and Nx

Below is an example of a Buildkite setup, building, and testing only what is affected.

```yaml {% fileName=".buildkite/pipeline.yml" %}
steps:
  - label: "Run nx affected"
    commands:
      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this
      # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - npx nx-cloud record -- echo Hello World

      # NX_BASE AND NX_HEAD env vars will be set by
      # the nx-set-shas plugin.
      - npx nx affected -t lint test build
      # Nx Cloud recommends fixes for failures to help you get CI green faster.
      # Learn more: https://nx.dev/ci/features/self-healing-ci
      - npx nx fix-ci
    plugins:
      - secrets:
          variables:
            GRAPHQL_API_TOKEN: GRAPHQL_API_TOKEN
      - nx-set-shas
```

### Get the Commit of the Last Successful Build

The Buildkite GraphQL API can be used to get the last successful run on the `main` branch and use this as a reference point for `NX_BASE`. The [nx-set-shas](https://github.com/buildkite-plugins/nx-set-shas-buildkite-plugin) plugin provides a convenient implementation of this functionality that you can drop into your existing CI pipeline.

To understand why knowing the last successful build is important for the `affected` command, check out the in-depth explanation [in the Nx documentation](https://nx.dev/ci/features/affected).
