---
title: Configuring CI Using Bitbucket Pipelines and Nx
description: Learn how to set up Bitbucket Pipelines for your Nx workspace to run affected commands, handle pull requests, and optimize CI performance.
---

# Configuring CI Using Bitbucket Pipelines and Nx

Below is an example of a Bitbucket Pipelines, building and testing only what is affected.

> Need a starting point? Generate a new workflow file with `nx g ci-workflow --ci=bitbucket-pipelines`

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
            - export NX_BRANCH=$BITBUCKET_PR_ID

            # This enables task distribution via Nx Cloud
            # Run this command as early as possible, before dependencies are installed
            # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
            # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
            # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

            - npm ci --legacy-peer-deps

            # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
            # npx nx-cloud record -- echo Hello World
            - npx nx affected --base=origin/main -t lint test build
            # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci

          after-script:
            - npx nx fix-ci

  branches:
    main:
      - step:
          name: 'Build and test affected apps on "main" branch changes'
          script:
            - export NX_BRANCH=$BITBUCKET_BRANCH
            # This enables task distribution via Nx Cloud
            # Run this command as early as possible, before dependencies are installed
            # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
            # Connect your workspace by running "nx connect" and uncomment this
            # - npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

            - npm ci --legacy-peer-deps

            # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
            # - npx nx-cloud record -- echo Hello World
            - npx nx affected -t lint test build --base=HEAD~1
```

The `pull-requests` and `main` jobs implement the CI workflow.

### Get the Commit of the Last Successful Build

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag an SHA in the main job once it succeeds and then use this tag as a base. See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repositories for more information.

We also have to set `NX_BRANCH` explicitly.
