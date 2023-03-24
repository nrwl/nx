# Configuring CI Using GitHub Actions and Nx

`GitHub` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The `Nx Set SHAs` provides a convenient implementation of this functionality which you can drop into your existing CI config.
To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Actions's docs](https://github.com/marketplace/actions/nx-set-shas#background).

Below is an example of a GitHub setup for an Nx workspace - building and testing only what is affected. For more details on how the action is used, head over to the [official docs](https://github.com/marketplace/actions/nx-set-shas).

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
      - uses: nrwl/nx-set-shas@v3
      - run: npm ci

      - run: npx nx format:check
      - run: npx nx affected -t lint --parallel=3
      - run: npx nx affected -t test --parallel=3 --configuration=ci
      - run: npx nx affected -t build --parallel=3
```

The `pr` and `main` jobs implement the CI workflow. Setting `timeout-minutes` is needed only if you have very slow tasks.

{% callout type="note" title="Tracking the origin branch" %}

If you're using this action in the context of a branch you may need to add `run: "git branch --track main origin/main"` before running the `nx affected` command since `origin/main` won't exist.

{% /callout %}

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

Read more about [Distributed Task Execution (DTE)](/core-features/distribute-task-execution).

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
    uses: nrwl/ci/.github/workflows/nx-cloud-main.yml@v0.11.3
    with:
      number-of-agents: 3
      parallel-commands: |
        npx nx-cloud record -- npx nx format:check
      parallel-commands-on-agents: |
        npx nx affected -t lint --parallel=3 & npx nx affected -t test --parallel=3 --configuration=ci & npx nx affected -t build --parallel=3

  agents:
    name: Nx Cloud - Agents
    uses: nrwl/ci/.github/workflows/nx-cloud-agents.yml@v0.11.3
    with:
      number-of-agents: 3
```

You can also use our [ci-workflow generator](/packages/workspace/generators/ci-workflow) to generate the workflow file.

{% /nx-cloud-section %}
