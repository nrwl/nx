---
title: Configuring CI Using Circle CI and Nx
description: Learn how to set up Circle CI for your Nx workspace using the Nx Orb to track successful builds, run affected commands, and optimize CI performance.
---

# Configuring CI Using Circle CI and Nx

Below is an example of a Circle CI setup, building, and testing only what is affected.

> Need a starting point? Generate a new workflow file with `nx g ci-workflow --ci=circleci`

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

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
      # - run: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

      - run: npm ci --legacy-peer-deps
      - nx/set-shas:
          main-branch-name: 'main'

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - run: npx nx-cloud record -- echo Hello World
      - run:
          command: npx nx affected -t lint test build
      # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
      - run:
          command: npx nx fix-ci
          when: always

workflows:
  version: 2

  ci:
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
