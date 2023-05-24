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
    uses: nrwl/ci/.github/workflows/nx-cloud-main.yml@v0.13.0
    with:
      number-of-agents: 3
      parallel-commands: |
        npx nx-cloud record -- npx nx format:check
      parallel-commands-on-agents: |
        npx nx affected -t lint --parallel=3 & npx nx affected -t test --parallel=3 --configuration=ci & npx nx affected -t build --parallel=3

  agents:
    name: Nx Cloud - Agents
    uses: nrwl/ci/.github/workflows/nx-cloud-agents.yml@v0.13.0
    with:
      number-of-agents: 3
```

You can also use our [ci-workflow generator](/packages/workspace/generators/ci-workflow) to generate the workflow file.

## Custom distributed CI with Nx Cloud

Our [reusable GitHub workflow](https://github.com/nrwl/ci) represents a good set of defaults that works for a large number of our users. However, reusable GitHub workflows come with their [limitations](https://docs.github.com/en/actions/using-workflows/reusing-workflows).

If the existing workflow doesn't satisfy your needs you should create your custom workflow. This is what the above config roughly encapsulates:

```yaml
name: CI
on:
  push:
    branches:
      - main
  pull_request:

env:
  NX_CLOUD_DISTRIBUTED_EXECUTION: true
  NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: 3
  NX_BRANCH: ${{ github.event.number || github.ref_name }}
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
  NX_CLOUD_AUTH_TOKEN: ${{ secrets.NX_CLOUD_AUTH_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

jobs:
  main:
    name: Nx Cloud - Main Job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        name: Checkout [Pull Request]
        if: ${{ github.event_name == 'pull_request' }}
        with:
          # By default, PRs will be checked-out based on the Merge Commit, but we want the actual branch HEAD.
          ref: ${{ github.event.pull_request.head.sha }}
          # We need to fetch all branches and commits so that Nx affected has a base to compare against.
          fetch-depth: 0

      - uses: actions/checkout@v3
        name: Checkout [Default Branch]
        if: ${{ github.event_name != 'pull_request' }}
        with:
          # We need to fetch all branches and commits so that Nx affected has a base to compare against.
          fetch-depth: 0

      # Set node/npm/yarn versions using volta
      - uses: volta-cli/action@v4
        with:
          package-json-path: '${{ github.workspace }}/package.json'

      - name: Use the package manager cache if available
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-

      - name: Install dependencies
        run: npm ci

      - name: Initialize the Nx Cloud distributed CI run
        run: npx nx-cloud start-ci-run

      - name: Run commands in parallel
        run: |
          pids=()
          # list of commands to be run on main has env flag NX_CLOUD_DISTRIBUTED_EXECUTION set to false
          NX_CLOUD_DISTRIBUTED_EXECUTION=false npx nx-cloud record -- npx nx format:check & pids+=($!)

          # list of commands to be run on agents
          npx nx affected -t lint --parallel=3 & 
          pids+=($!)

          npx nx affected -t test --parallel=3 --configuration=ci & 
          pids+=($!)

          npx nx affected -t build --parallel=3 & 
          pids+=($!)

          # run all commands in parallel and bail if one of them fails
          for pid in \${pids[*]}; do
            if ! wait $pid; then
              exit 1
            fi
          done

          exit 0

      - name: Stop all running agents for this CI run
        # It's important that we always run this step, otherwise in the case of any failures in preceding non-Nx steps, the agents will keep running and waste billable minutes
        if: ${{ always() }}
        run: npx nx-cloud stop-all-agents

  agents:
    name: Agent ${{ matrix.agent }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent:
          - [1, 2, 3]
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      # Set node/npm/yarn versions using volta
      - uses: volta-cli/action@v4
        with:
          package-json-path: '${{ github.workspace }}/package.json'

      - name: Use the package manager cache if available
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-

      - name: Install dependencies
        run: npm ci

      - name: Start Nx Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
        env:
          NX_AGENT_NAME: ${{matrix.agent}}
```

{% /nx-cloud-section %}
