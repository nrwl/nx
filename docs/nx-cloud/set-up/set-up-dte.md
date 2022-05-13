# Set up Distributed Task Execution

To enable distributed task execution, the following has to be true:

1. `NX_CLOUD_DISTRIBUTED_EXECUTION` has to be set to `true`.
2. Agents must be started using the nx-cloud start-agent command, and must be stopped at the end using `nx-cloud stop-all-agents`.

The examples below use 3 agents to run all builds, tests, and lints.

Note that only cacheable operations can be distributed because they have to be replayed on the main job.

You don't have to distribute every single command. For instance, it's pretty common to send test coverage reports from a single machine. You can do it as follows:

```yaml
- run: npx nx affected --target=test --parallel --max-parallel=2
- run: NX_CLOUD_DISTRIBUTED_EXECUTION=false npx nx affected --target=send-coverage-reports --parallel
```

Distributed task execution will copy all artifacts from agents to the main job, so after the `affected --target=test` command completes, all the coverage reports will be on the main job.

Note, the `--parallel` flag is propagated to Nx Cloud agents.

## Agents

In the examples below, the config creates one main job and three agent jobs. All four jobs have the same environment and the same source code. The four jobs will start around the same time. And, once the main job completes, all the agents will be stopped.

It's important to note that an Nx Cloud agent isn't a machine but rather a long-running process that runs on a machine. In the examples below, the config provisions three machines that run `nx-cloud start-agent`. Nx Cloud does not start agents. It simply coordinates work between the agents that you start in your CI. So you are in control of how many agents you want to use and where they are located.

## Additional Configuration Options

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT` to say 8 will tell Nx Cloud assume that there are 8 agents running.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE` to false will tell Nx Cloud not to stop agents if a command fails. You need to make sure to invoke `nx-cloud stop-all-agents` even if CI fails.

## Distributed Task Execution and Sharding

The Nx Cloud distributed task execution model is akin to what is used at Google or Facebook. It scales better and provided more flexiblity than sharding tasks across agents. [Read more about Distributed Task Execution and how it compares to binning/sharding.](https://blog.nrwl.io/distributing-ci-binning-and-distributed-task-execution-632fe31a8953?source=friends_link&sk=5120b7ff982730854ed22becfe7a640a)

## CI/CD Examples

The examples below show how to set up CI using Nx and Nx Cloud using distributed task execution and distributed caching.

Every organization manages their CI/CD pipelines differently, so the examples don't cover org-specific aspects of CI/CD (e.g., deployment). They mainly focus on configuring Nx correctly.

Read the guides for more information on how to configure them in CI.

### GitHub Actions

An example of a GitHub Actions setup for an Nx workspace connected to Nx Cloud.

```yml
name: CI
on:
  push:
    branches:
      - main
  pull_request:

env:
  NX_CLOUD_DISTRIBUTED_EXECUTION: true

jobs:
  main:
    runs-on: ubuntu-latest
    if: ${{ github.event_name != 'pull_request' }}
    steps:
      - uses: actions/checkout@v2
        name: Checkout [main]
        with:
          fetch-depth: 0
      - name: Derive appropriate SHAs for base and head for `nx affected` commands
        uses: nrwl/nx-set-shas@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '14'
      - run: npm install
      - run: npx nx-cloud start-ci-run
      - run: npx nx affected --target=build --parallel --max-parallel=3
      - run: npx nx affected --target=test --parallel --max-parallel=2
      - run: npx nx-cloud stop-all-agents
  pr:
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'pull_request' }}
    steps:
      - uses: actions/checkout@v2
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0
      - name: Derive appropriate SHAs for base and head for `nx affected` commands
        uses: nrwl/nx-set-shas@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '14'
      - run: npm install
      - run: npx nx-cloud start-ci-run
      - run: npx nx affected --target=build --parallel --max-parallel=3
      - run: npx nx affected --target=test --parallel --max-parallel=2
      - run: npx nx-cloud stop-all-agents
  agents:
    runs-on: ubuntu-latest
    name: Agent 1
    timeout-minutes: 60
    strategy:
      matrix:
        agent: [1, 2, 3]
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '14'
      - run: npm install
      - name: Start Nx Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
```

The `pr` and `main` jobs implement the CI workflow. The 3 agent jobs execute the tasks created by `pr` and `main`. Setting timeout-minutes is needed only if you have very slow tasks.

Note that if you use an older version of `@nrwl/nx-cloud`, you need to add the following two env variables.

```yml
env:
  NX_BRANCH: ${{ github.head_ref }}
  NX_RUN_GROUP: ${{ github.run_id }}
```

You can find more information about using GitHub Actions on the [`nx-tag-successful-ci-run`](https://github.com/nrwl/nx-tag-successful-ci-run) and [`nx-set-shas`](https://github.com/nrwl/nx-set-shas) repos.

### Circle CI

An example of a Circle CI setup for an Nx workspace connected to Nx Cloud.

```yml
version: 2.1
orbs:
  nx: nrwl/nx@1.0.0
jobs:
  agent:
    steps:
      - checkout
      - run: npm install
      - run:
          command: npx nx-cloud start-agent
          no_output_timeout: 60m
  main:
    environment:
      NX_CLOUD_DISTRIBUTED_EXECUTION: 'true'
    steps:
      - checkout
      - run: npm install
      - nx/set-shas
      - run: npx nx affected --base=$NX_BASE --target=build --parallel --max-parallel=3
      - run: npx nx affected --base=$NX_BASE --target=test --parallel --max-parallel=2
      - run: npx nx-cloud stop-all-agents
  pr:
    environment:
      NX_CLOUD_DISTRIBUTED_EXECUTION: 'true'
    steps:
      - checkout
      - run: npm install
      - nx/set-shas
      - run: npx nx affected --base=$NX_BASE --target=build --parallel --max-parallel=3
      - run: npx nx affected --base=$NX_BASE --target=test --parallel --max-parallel=2
      - run: npx nx-cloud stop-all-agents
workflows:
  build:
    jobs:
      - agent:
          name: 'agent1'
      - agent:
          name: 'agent2'
      - agent:
          name: 'agent3'
      - main:
          filters:
            branches:
              only: main
      - pr:
          filters:
            branches:
              ignore: main
```

The `pr` and `main` jobs implement the CI workflow. The 3 agent jobs execute the tasks created by `pr` and `main`. Setting `no_output_timeout` is needed only if you have very slow tasks.

## Azure Pipelines

Unlike GitHub actions and CircleCI, we don't have the accordance to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1`, but a more robust solution would be to tag a SHA in the main job once it succeeds, and then use this tag as a base. See the [`nx-tag-successful-ci-run`](https://github.com/nrwl/nx-tag-successful-ci-run) and [`nx-set-shas`](https://github.com/nrwl/nx-set-shas) repos for more information.

We also have to set `NX_BRANCH` explicitly.

```yml
trigger:
  - main
pr:
  - main

variables:
  NX_CLOUD_DISTRIBUTED_EXECUTION: 'true'
  ${{ if eq(variables['Build.SourceBranchName'], 'main') }}:
    NX_BRANCH: 'main'
  ${{ if ne(variables['Build.SourceBranchName'], 'main') }}:
    NX_BRANCH: $(System.PullRequest.PullRequestNumber)

jobs:
  - job: agent
    pool:
      vmImage: 'ubuntu-latest'
    strategy:
      parallel: 4
    steps:
      - script: npm i
      - script: pnpx nx-cloud start-agent

  - job: main
    pool:
      vmImage: 'ubuntu-latest'
    condition: ne(variables['Build.Reason'], 'PullRequest'))
    steps:
      - script: npm i
      - script: npx nx-cloud start-ci-run
      - script: npx nx affected --base=HEAD~1 --target=build --parallel --max-parallel=3
      - script: npx nx affected --base=HEAD~1 --target=test --parallel --max-parallel=2
      - script: npx nx-cloud stop-all-agents

  - job: pr
    pool:
      vmImage: 'ubuntu-latest'
    condition: eq(variables['Build.Reason'], 'PullRequest'))
    steps:
      - script: npm i
      - script: npx nx-cloud start-ci-run
      - script: npx nx affected --target=build --parallel --max-parallel=3
      - script: npx nx affected --target=test --parallel --max-parallel=2
      - script: npx nx-cloud stop-all-agents
```

## Jenkins

Unlike GitHub actions and CircleCI, we don't have the accordance to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1`, but a more robust solution would be to tag a SHA in the main job once it succeeds, and then use this tag as a base.

We also have to set `NX_BRANCH` explicitly.

```yml
pipeline {
agent none
environment {
NX_CLOUD_DISTRIBUTED_EXECUTION = 'true'
NX_BRANCH = env.BRANCH_NAME.replace('PR-', '')
NX_RUN_GROUP = env.BUILD_ID // has to be unique
}
stages {
stage('Pipeline') {
parallel {
stage('Agent') {
matrix {
agent any
axes {
axis {
name 'Number'
values '1', '2', '3'
}
}
steps {
sh "npm install"
sh "npx nx-cloud start"
}
}
}
stage('Main') {
when {
branch 'main'
}
agent any
steps {
sh "npm install"
sh "npx nx-cloud start-ci-run"
sh "npx nx affected --base=HEAD~1 --target=build --parallel --max-parallel=3"
sh "npx nx affected --base=HEAD~1 --target=test --parallel --max-parallel=2"
sh "npx nx-cloud stop-all-agents"
}
}
stage('PR') {
when {
not { branch 'main' }
}
agent any
steps {
sh "npm install"
sh "npx nx-cloud start-ci-run"
sh "npx nx affected --target=build --parallel --max-parallel=3"
sh "npx nx affected --target=test --parallel --max-parallel=2"
sh "npx nx-cloud stop-all-agents"
}
}
}
}
}
```

## Additional Notes

### Env Variables

The `@nrwl/nx-cloud` requires the `NX_BRANCH` environment variables to be set. For many CI providers (e.g., GitHub Actions), the runner is able to set it automatically. For others, the variable will have to be set manually. If you set it manually, note that `NX_BRANCH` has to be set to a PR number for the GitHub integration to work.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION` to true enables distributed task execution.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT` to say 8 will tell Nx Cloud assume that there are 8 agents running.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE` to true will tell Nx Cloud not to stop agents if a command fails. You need to make sure to invoke nx-cloud stop-all-agents even if CI fails.

Setting `NX_VERBOSE_LOGGING` to true will output the debug information about agents communicating with the main job. It's a good way to troubleshoot issues.

Setting `NX_CLOUD_ENV_NAME` will prefix all your commands so you can easily distinguish them in the UI and in GitHub comments. For instance, if you run the same set of commands on Windows and Linux machines, you can set `NX_CLOUD_ENV_NAME` to win on the Windows agent, and linux on Linux agents.
