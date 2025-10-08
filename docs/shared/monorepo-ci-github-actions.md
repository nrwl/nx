---
title: Configuring CI Using GitHub Actions and Nx
description: Learn how to set up GitHub Actions for your Nx workspace using nx-set-shas to track successful builds, run affected commands, and optimize CI performance.
---

# Configuring CI Using GitHub Actions and Nx

Below is an example of a GitHub Actions setup, building, and testing only what is affected.

> Need a starting point? Generate a new workflow file with `nx g ci-workflow --ci=github`

```yaml {% fileName=".github/workflows/ci.yml" %}
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          filter: tree:0
          fetch-depth: 0

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
      # - run: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

      # Cache node_modules
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - uses: nrwl/nx-set-shas@v4

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - run: npx nx-cloud record -- echo Hello World
      - run: npx nx affected -t lint test build
      # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
      - run: npx nx fix-ci
        if: always()
```

### Get the Commit of the Last Successful Build

The `GitHub` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The [nrwl/nx-set-shas](https://github.com/marketplace/actions/nx-set-shas) provides a convenient implementation of this functionality, which you can drop into your existing CI workflow.

To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Actions's docs](https://github.com/marketplace/actions/nx-set-shas#background).
