---
title: Configuring CI Using GitLab and Nx
description: Learn how to set up GitLab CI for your Nx workspace with examples of YAML configuration for building and testing affected projects efficiently.
---

# Configuring CI Using GitLab and Nx

Below is an example of a GitLab setup, building and testing only what is affected.

> Need a starting point? Generate a new workflow file with `nx g ci-workflow --ci=gitlab`

```yaml {% fileName=".gitlab-ci.yml" %}
image: node:20
variables:
  CI: 'true'

# Main job
CI:
  interruptible: true
  only:
    - main
    - merge_requests
  script:
    # This enables task distribution via Nx Cloud
    # Run this command as early as possible, before dependencies are installed
    # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
    # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
    # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

    - npm ci --legacy-peer-deps
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

    # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
    # - npx nx-cloud record -- echo Hello World
    - npx nx affected -t lint test build
    # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci

  after_script:
    - npx nx fix-ci
```
