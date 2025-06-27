---
title: Configuring CI Using Bitbucket Pipelines and Nx
description: Learn how to set up Bitbucket Pipelines for your Nx workspace to run affected commands, handle pull requests, and optimize CI performance.
---

# Configuring CI Using Bitbucket Pipelines and Nx

Below is an example of a Bitbucket Pipelines, building and testing only what is affected.

```yaml {% fileName="bitbucket-pipelines.yml" %}
image: node:20

clone:
  depth: full

pipelines:
  pull-requests:
    '**':
      - step:
          name: 'Build and test affected apps on Pull Requests'
          script:
            # This line enables distribution
            # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "e2e-ci" targets have been requested
            - npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
            - npm ci

            # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
            # This requires connecting your workspace to Nx Cloud. Run "nx connect" to get started w/ Nx Cloud
            # - npx nx-cloud record -- nx format:check

            # Without Nx Cloud, run format:check directly
            - npx nx format:check
            - npx nx affected -t lint test build e2e-ci --base=origin/main

  branches:
    main:
      - step:
          name: "Build and test affected apps on 'main' branch changes"
          script:
            - export NX_BRANCH=$BITBUCKET_BRANCH
            # This line enables distribution
            # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "e2e-ci" targets have been requested
            # - npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
            - npm ci

            # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
            # This requires connecting your workspace to Nx Cloud. Run "nx connect" to get started w/ Nx Cloud
            # - npx nx-cloud record -- nx format:check

            # Without Nx Cloud, run format:check directly
            - npx nx format:check
            - npx nx affected -t lint test build e2e-ci --base=HEAD~1
```

The `pull-requests` and `main` jobs implement the CI workflow.

### Get the Commit of the Last Successful Build

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag an SHA in the main job once it succeeds and then use this tag as a base. See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repositories for more information.

We also have to set `NX_BRANCH` explicitly.
