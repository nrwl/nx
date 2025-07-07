---
title: Configuring CI Using GitLab and Nx
description: Learn how to set up GitLab CI for your Nx workspace with examples of YAML configuration for building and testing affected projects efficiently.
---

# Configuring CI Using GitLab and Nx

Below is an example of a GitLab setup, building and testing only what is affected.

```yaml {% fileName=".gitlab-ci.yml" %}
image: node:20

variables:
  GIT_DEPTH: 0

main:
  interruptible: true
  only:
    - main
    - merge_requests
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
  script:
    # Connect your workspace on <%= nxCloudHost %> and uncomment this to enable task distribution.
    # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "e2e-ci" targets have been requested
    # - npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"

    - npm ci --cache .npm --prefer-offline
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

    # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
    # This requires connecting your workspace to Nx Cloud. Run "nx connect" to get started w/ Nx Cloud
    # - npx nx-cloud record -- nx format:check

    # Without Nx Cloud, run format:check directly
    - npx nx format:check --base=$NX_BASE --head=$NX_HEAD
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint test build e2e-ci
```
