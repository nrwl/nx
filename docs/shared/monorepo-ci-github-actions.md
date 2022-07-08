# Configuring CI Using GitHub Actions and Nx

The `GitHub` can track the last successful run on `main` branch and use this as a reference point for the `BASE`. The `Nx Set SHAs` provides convenient implementation of this functionality which you can drop into you existing CI config.
To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation at Actions's docs](https://github.com/marketplace/actions/nx-set-shas#background).

Below is an example of a GitHub setup for an Nx workspace only building and testing what is affected. For more details on how the orb is used, head over to the [official docs](https://github.com/marketplace/actions/nx-set-shas).

```yaml
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - uses: nrwl/nx-set-shas@v2
      - run: npm ci

      - run: npx nx workspace-lint
      - run: npx nx format:check
      - run: npx nx affected --target=lint --parallel=3
      - run: npx nx affected --target=test --parallel=3 --ci --code-coverage
      - run: npx nx affected --target=build --parallel=3
```

The `pr` and `main` jobs implement the CI workflow. Setting `timeout-minutes` is needed only if you have very slow tasks.

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

In order to use distributed task execution, we need to start agents and set the `NX_CLOUD_DISTRIBUTED_EXECUTION` flag to `true`.

Read more about the [Distributed CI setup with Nx Cloud](/using-nx/ci-overview#distributed-ci-with-nx-cloud).

```yaml
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    name: Nx Cloud - Main Job
    uses: nrwl/ci/.github/workflows/nx-cloud-main.yml@v0.6
    with:
      number-of-agents: 3
      parallel-commands: |
        npx nx-cloud record -- npx nx workspace-lint
        npx nx-cloud record -- npx nx format:check
      parallel-commands-on-agents: |
        npx nx affected --target=lint --parallel=3
        npx nx affected --target=test --parallel=3 --ci --code-coverage
        npx nx affected --target=build --parallel=3

  agents:
    name: Nx Cloud - Agents
    uses: nrwl/ci/.github/workflows/nx-cloud-agents.yml@v0.6
    with:
      number-of-agents: 3
```

You can also use our [ci-workflow generator](/packages/workspace/generators/ci-workflow) to generate the workflow file.

{% /nx-cloud-section %}
