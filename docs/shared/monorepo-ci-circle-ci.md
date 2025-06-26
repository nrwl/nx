---
title: Configuring CI Using Circle CI and Nx
description: Learn how to set up Circle CI for your Nx workspace using the Nx Orb to track successful builds, run affected commands, and optimize CI performance.
---

# Configuring CI Using Circle CI and Nx

Below is an example of a Circle CI setup, building, and testing only what is affected.

```yaml {% fileName=".circleci/config.yml" %}
version: 2.1

orbs:
  nx: nrwl/nx@1.6.2

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      # This line enables distribution
      # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "e2e-ci" targets have been requested
      # - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
      - run: npm ci

      - nx/set-shas

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # This requires connecting your workspace to Nx Cloud. Run "nx connect" to get started w/ Nx Cloud
      # - run: npx nx-cloud record -- nx format:check

      # Without Nx Cloud, run format:check directly
      - run: npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint test build e2e-ci
workflows:
  build:
    jobs:
      - main
```

### Get the Commit of the Last Successful Build

`CircleCI` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The [Nx Orb](https://github.com/nrwl/nx-orb) provides a convenient implementation of this functionality, which you can drop into your existing CI workflow. Specifically, for push commits, `nx/set-shas` populates the `$NX_BASE` environment variable with the commit SHA of the last successful run.

To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Orb's docs](https://github.com/nrwl/nx-orb#background).

### Using CircleCI in a private repository

To use the [Nx Orb](https://github.com/nrwl/nx-orb) with a private repository on your main branch, you need to grant the orb access to your CircleCI API. Create an environment variable called `CIRCLE_API_TOKEN` in the context of the project.

{% callout type="warning" title="Caution" %}
It should be a user token, not the project token.
{% /callout %}
