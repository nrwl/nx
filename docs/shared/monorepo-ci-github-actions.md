---
title: Configuring CI Using GitHub Actions and Nx
description: Learn how to set up GitHub Actions for your Nx workspace using nx-set-shas to track successful builds, run affected commands, and optimize CI performance.
---

# Configuring CI Using GitHub Actions and Nx

Below is an example of a GitHub Actions setup, building, and testing only what is affected.

```yaml {% fileName=".github/workflows/ci.yml" %}
name: CI
on:
  push:
    branches:
      # Change this if your primary branch is not main
      - main
  pull_request:

# Needed for nx-set-shas when run on the main branch
permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: tree:0

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      # This line enables distribution
      # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "e2e-ci" targets have been requested
      # - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # This requires connecting your workspace to Nx Cloud. Run "nx connect" to get started w/ Nx Cloud
      # - run: npx nx-cloud record -- nx format:check

      # Without Nx Cloud, run format:check directly
      - run: npx nx format:check
      - run: npx nx affected -t lint test build e2e-ci
```

### Get the Commit of the Last Successful Build

The `GitHub` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The [nrwl/nx-set-shas](https://github.com/marketplace/actions/nx-set-shas) provides a convenient implementation of this functionality, which you can drop into your existing CI workflow.

To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Actions's docs](https://github.com/marketplace/actions/nx-set-shas#background).
