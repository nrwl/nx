# Custom Distributed Task Execution on Github Actions

Using [Nx Agents](/ci/features/distribute-task-execution) is the easiest way to distribute task execution, but it your organization may not be able to use hosted Nx Agents. With an [enterprise license](/enterprise), you can set up distributed task execution on your own CI provider using the recipe below.

## Run Custom Agents on GitHub

Our [reusable GitHub workflow](https://github.com/nrwl/ci) represents a good set of defaults that works for a large number of our users. However, reusable GitHub workflows come with their [limitations](https://docs.github.com/en/actions/using-workflows/reusing-workflows).

If the reusable workflow above doesn't satisfy your needs you should create a custom workflow. If you were to rewrite the reusable workflow yourself, it would look something like this:

```yaml {% fileName=".github/workflows/ci.yml" %}
name: CI
on:
  push:
    branches:
      - main
  pull_request:

# Needed for nx-set-shas when run on the main branch
permissions:
  actions: read
  contents: read

env:
  NX_CLOUD_DISTRIBUTED_EXECUTION: true # this enables DTE
  NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: 3 # expected number of agents
  NX_BRANCH: ${{ github.event.number || github.ref_name }}
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }} # this is needed if our pipeline publishes to npm

jobs:
  main:
    name: Nx Cloud - Main Job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        name: Checkout [Pull Request]
        if: ${{ github.event_name == 'pull_request' }}
        with:
          # By default, PRs will be checked-out based on the Merge Commit, but we want the actual branch HEAD.
          ref: ${{ github.event.pull_request.head.sha }}
          # We need to fetch all branches and commits so that Nx affected has a base to compare against.
          fetch-depth: 0

      - uses: actions/checkout@v4
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
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check out the default branch
        run: git branch --track main origin/main

      - name: Initialize the Nx Cloud distributed CI run and stop agents when the build tasks are done
        run: npx nx-cloud start-ci-run --distribute-on="manual" --stop-agents-after=e2e-ci

      - name: Run commands in parallel
        run: |
          # initialize an array to store process IDs (PIDs)
          pids=()

          # function to run commands and store the PID
          function run_command() {
            local command=$1
            $command &  # run the command in the background
            pids+=($!)  # store the PID of the background process
          }

          # list of commands to be run on main has env flag NX_CLOUD_DISTRIBUTED_EXECUTION set to false
          run_command "NX_CLOUD_DISTRIBUTED_EXECUTION=false npx nx-cloud record -- nx format:check"

          # list of commands to be run on agents
          run_command "npx nx affected -t lint,test,build,e2e-ci --parallel=3"

          # wait for all background processes to finish
          for pid in ${pids[*]}; do
            if ! wait $pid; then
              exit 1  # exit with an error status if any process fails
            fi
          done

          exit 0 # exits with success status if a all processes complete successfully

  agents:
    name: Agent ${{ matrix.agent }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        # Add more agents here as your repository expands
        agent: [1, 2, 3]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # Set node/npm/yarn versions using volta
      - uses: volta-cli/action@v4
        with:
          package-json-path: '${{ github.workspace }}/package.json'

      - name: Use the package manager cache if available
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start Nx Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
        env:
          NX_AGENT_NAME: ${{ matrix.agent }}
```

There are comments throughout the workflow to help you understand what is happening in each section.
