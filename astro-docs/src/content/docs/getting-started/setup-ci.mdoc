---
title: 'Setting Up CI'
description: Set up CI for your Nx workspace, then add remote caching and distributed task execution with Nx Cloud to cut pipeline time and cost.
sidebar:
  order: 7
  label: 'Setting Up CI'
filter: 'type:Guides'
---

{% llm_copy_prompt title="Let an AI agent set it up for you" %}
Help me set up CI for my Nx workspace with remote caching.

Before touching anything, verify the workspace state:

**A. Is Nx installed?**

- Check for `nx.json` and `nx` in `package.json` devDeps.
- Confirm `node_modules` exists. If not, install deps using the package manager that matches my lockfile (`pnpm install`, `npm install`, or `yarn`).
- If `nx.json` is missing entirely, ask me before running `npx nx@latest init`.

**B. Is there an existing CI workflow?**

- **Yes, and it already calls `nx run` or `nx run-many`**: likely already set up. Confirm with me before changing anything.
- **Yes, but it calls raw tooling directly** (`jest`, `tsc`, `eslint`, etc.): work with me to update it. Propose minimal edits swapping the raw calls for `nx run-many -t <task>` or `nx run <project>:<task>`. Show me the diff and wait for approval before writing.
- **No**: run `nx g @nx/workspace:ci-workflow --ci=<provider>`. Detect the provider from `git remote -v` (github.com -> `github`, gitlab.com -> `gitlab`, etc.). Ask me if it's ambiguous.

Then connect to Nx Cloud:

1. Run `npx nx-cloud onboard connect-workspace` and parse the JSON.
2. If the response includes an `actionRequired` payload (typically GitHub authorization), surface the message and any URLs to me and stop. Do not retry blindly.
3. Confirm `nxCloudId` is written to `nx.json`. If it is not, surface the JSON error to me instead of retrying.

Stage the generated or edited files but do not commit on my behalf. Stay on topic: getting remote cache running in CI. For deeper coverage link to {pageUrl} and to [/docs/features/ci-features/remote-cache](/docs/features/ci-features/remote-cache).

Page: {pageUrl}
{% /llm_copy_prompt %}

Start with CI that runs your tasks through Nx on a single machine.
Then connect Nx Cloud for remote caching and distribution, which cut both pipeline time and machine-minutes.
For a finished pipeline, jump to the [complete example](#complete-example).

{% call_to_action variant="default" title="Tour an Nx Cloud workspace" url="https://cloud.nx.app/demo/intro?utm_source=nx-docs&utm_medium=website&utm_campaign=nx-cloud-demo&utm_content=ci-setup" description="See distributed task execution, caching, and run analytics on a live workspace before you wire up your own CI." /%}

## Make sure you have Nx

For existing repos, run the init command and follow the prompts:

```shell
npx nx@latest init
```

Or start fresh with a new repo:

```shell
npx create-nx-workspace@latest
```

## Run CI with Nx

Caching, affected, and distribution only apply to tasks that `nx` runs.
`nx test` is fine, and so is `npm test` if it wraps `nx test`.
Direct calls to `jest`, `tsc`, or `eslint` skip Nx.

Use `nx affected` to run tasks only for projects your change touches:

```yaml
# .github/workflows/ci.yml
# ... name and triggers
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      # ... set up Node.js
      - run: npm ci
      - uses: nrwl/nx-set-shas@v5
      - run: npx nx affected -t lint test build
```

`fetch-depth: 0` gives Nx the git history it needs to compare commits.
On a pull request, Nx compares the branch with `main` (or `defaultBase` in `nx.json`).
On a push to `main`, `nrwl/nx-set-shas` sets the base to the last commit that passed CI.
For other CI providers, see [set the affected base commit in CI](/docs/kb/affected-base-commit).

Nx runs the affected tasks in parallel on the CI machine, in the order the task graph requires.

{% aside type="note" title="No CI workflow yet?" %}
Generate one:

```shell
nx add @nx/workspace
nx g @nx/workspace:ci-workflow --ci=github
```

Supported `--ci` values: `github`, `circleci`, `gitlab`, `azure`, `bitbucket-pipelines`.
The generated workflow also includes the Nx Cloud steps described below.
{% /aside %}

## Add remote caching

With remote caching, a task that already ran with the same inputs, in CI or on a teammate's machine, is restored from the cache instead of running again.
A pipeline with many cache hits finishes sooner and uses fewer machine-minutes, which reduces cost.
Setup takes under 5 minutes and is free to start.

{% call_to_action variant="default" title="Connect your workspace" url="https://cloud.nx.app/setup/connect-workspace/guide?utm_source=nx-docs&utm_medium=website&utm_campaign=nx-cloud-signup&utm_content=ci-setup" description="Setup takes less than 5 minutes" /%}

For read-only and read-write CI tokens, see [CI access tokens](/docs/kb/access-tokens).

## Distribute tasks with Nx Agents

With Nx Agents, your tasks run across several machines instead of one.
With [_dynamic task packing_](/docs/features/ci-features/distribute-task-execution#how-dynamic-task-packing-works), Nx Cloud uses what it knows about each task, such as its duration and its CPU and memory use, to keep agents close to capacity, so fewer machine-minutes sit idle.
In most workspaces, that adds up to about 50% fewer machine-minutes than remote caching alone.

Add a `.nx/ci-config.yaml` file with the number of agents, then start them with `start-nx-agents`:

```yaml
# .nx/ci-config.yaml
dte:
  distribute-on: 3 linux-large-js
```

```yaml {% meta="{7}" %}
# .github/workflows/ci.yml
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      # ... checkout
      - run: npx nx-cloud start-nx-agents
      # ... set up Node.js, install dependencies, and set SHAs
      - run: npx nx affected -t lint test build
```

{% aside type="note" title="Nothing to tune" %}
Nx Cloud decides how many tasks run on each agent, so there's no `--parallel` value to set.
For every configuration option, see the [CI configuration file reference](/docs/reference/nx-cloud/ci-config).
{% /aside %}

## Complete example

This GitHub Actions pipeline combines affected, remote caching, and distribution:

```yaml
// .nx/ci-config.yaml
dte:
  # Distribute across 3 agents using the linux-large-js launch template
  distribute-on: 3 linux-large-js
lifecycle:
  # Shut idle agents down once every build task has been requested
  stop-after:
    - build
```

```yaml
// .github/workflows/ci.yml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      # fetch-depth: 0 gives Nx the full history it needs to work out what changed
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          filter: tree:0

      # Provisions the agents declared in .nx/ci-config.yaml.
      # Run it before installing dependencies so agents boot while this job installs.
      - run: npx nx-cloud start-nx-agents

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: 'npm'

      - run: npm ci

      # Sets the base to the last commit that passed CI on main
      - uses: nrwl/nx-set-shas@v5

      # Runs lint, test, and build only for projects affected by this change.
      # Nx Cloud distributes these tasks across the agents started above.
      - run: npx nx affected -t lint test build
```

For CircleCI, GitLab, Azure Pipelines, Jenkins, and Bitbucket Pipelines, see [CI workflow examples](/docs/kb/ci-workflow-examples).

## Next steps

{% cardgrid %}

{% linkcard title="Remote caching" description="Share task results across CI runs and developer machines" href="/docs/features/ci-features/remote-cache" /%}

{% linkcard title="Distribute task execution" description="See how dynamic task packing fills agents" href="/docs/features/ci-features/distribute-task-execution" /%}

{% /cardgrid %}
