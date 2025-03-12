# Assignment Rules

Assignment rules allow you to control which tasks can run on which agents. Save on agent costs by provisioning different sizes of agents to suite the individual needs of your tasks. Ensure resource intensive targets like `e2e-ci` and `build` have what they need by using larger agents and with a specified parallelism. Lighter tasks like `lint` and `test` can run on smaller agents.

Assignment rules are defined in `yaml` files within your workspace's `.nx/workflows` directory. You can use assignment rules with [Manual Distributed Task Execution (DTE)](/ci/recipes/dte) or with [dynamic Nx agents](/ci/features/dynamic-agents). Note that additional configuration is required when using Manual DTE.

## How to Define an Assignment Rule

Each assignment rule has one of the following properties that it matches against tasks: `projects`, `targets`, and/or `configurations`. You can provide a list of globs to match against the tasks in your workspace. It also has a list of possible [agent types](/ci/reference/launch-templates) that tasks with the matching properties can run on. Rules are defined in yaml like the following:

{% tabs %}
{% tab label="Assignment rules with Nx Agents" %}

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  default: 5 linux-medium-js, 5 linux-large-js

assignment-rules:
  - projects:
      - app1
    targets:
      - e2e-ci*
    configurations:
      - production
    run-on:
      - agent: linux-medium
        parallelism: 5

  - targets:
      - lint
      - build
    run-on:
      - agent: linux-large
        parallelism: 10
```

{% /tab %}
{% tab label="Assignment rules with manual DTE" %}

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules:
  - projects:
      - app1
    targets:
      - e2e-ci*
    run-on:
      - agent: linux-medium
        parallelism: 5

  - targets:
      - lint,build
    run-on:
      - agent: linux-large
        parallelism: 10
```

{% /tab %}
{% /tabs %}

The above rule will match any task that has a project named `app1`, any targets that begin with `e2e-ci`, and a configuration named `production`. Any tasks that match this rule will only be allowed to run on agents with `linux-medium-js` launch templates. Agents assigned these tasks will also be able to execute up to `5` tasks in parallel.

The second rule above will match any task that has a `lint` or `build` target. These tasks only run on `linux-large` agents and up to 10 tasks can be executed in parallel by agents of that type.

You can mix and match any of the criteria in an assignment rule provided that you follow the constraints:

- At least one of the following properties is defined: `projects`, `targets`, `configurations`.
- There is at least one [agent type](/ci/reference/launch-templates) specified in the `run-on` field. If no parallelism is specified, the parallelism of the executed command will be used instead. If that is not specified, then the parallelism will default to `1`
- For assignment rules with Nx Agents, every changeset in your `distribute-on` field must include at **least one agent** that matches each agent type specified in the `runs-on` field across all assignment rules. For example, if your rules distribute tasks on `linux-small-js`, `linux-medium-js`, and `linux-large-js`, then at least one agent of each type must be available; otherwise, tasks associated with those rules cannot be executed.

{% callout type="note" title="If you are using Manual DTE, you must define your own agent types" %}
You must define your own agent types and attach them to your agents using the `NX_AGENT_LAUNCH_TEMPLATE` environment variable. Ensure that for each `runs-on` field in your assignment rules, you have corresponding agents in your agent pool that have the same agent type.
See below for an [example](#using-assignment-rules-with-manual-dte) of how to define your own agent types when using Manual DTE.
{% /callout %}

### Assignment Rule Property Reference

#### projects

A list of string globs that matches against projects in your workspace.

#### targets

A list of string globs that matches against targets in your workspace.

#### configurations

A list of string globs that matches against configurations in your workspace.

#### run-on

Specification of which agent and how to run your tasks:

- **agent**: the type of agent to run on (`linux-medium`, `linux-large`)
- **parallelism**: the number of parallel executions allowed for agents of a given type

### Glob Reference

You can use globs for better control over how to define your assignment rules.

##### `*` matches zero or more characters

- ✅ `lint*` matches `lint-js`, `linting-test`
- ✅ `*test*` matches `business-test-2`, `test-12`, `10-test`
- ❌ `lint*` does not match `eslint`, `lin-test`, `lin`

##### `?` matches exactly one character

- ✅ `app?` matches `app1`, `app3`, `apps`
- ❌ `app?` does not match `app10`, `apps1`, `bus-app1`

##### `!` at start negates the pattern

- ✅ `!prod` matches `development`, `staging`
- ❌ `!prod` does not match `prod`

#### List delimited globs

If you provide a list of globs to an individual rule property (`projects`, `targets`, `configurations`), it will match any of the patterns for that given property.

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules:
  - targets:
      - e2e-ci*
      - lint*
    run-on:
      - agent: linux-medium
        parallelism: 2
```

The following rule will match the following tasks:

- starts with `e2e-ci` (i.e `e2e-ci--playwright-button-test`)
- starts with `lint` (i.e `lint-js`)

#### Comma delimited globs

Within each list entry, you can define a comma delimited list of globs. This notation will match a given property only if all globs match.

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules:
  - targets:
      - 'e2e-ci*,*server-test'
      - 'lint*'
    run-on:
      - agent: linux-large
        parallelism: 5
```

The following rule will match the following tasks:

- starts with `e2e-ci` and ends with `server-test` (i.e `e2e-ci--playwright-server-test`)
- starts with `lint` (i.e `lint-js`)

### Configuring Parallelism through Assignment Rules

You can specify how many tasks of a certain type can run in parallel on a particular agent. Each agent object within the `run-on` list can have the `parallelism` property. Configuring parallelism through your assignment rules will override the other parallelism configurations in your workspace. For a given command run with DTE, parallelism is determined by in the following order:

1. Parallelism defined in the assignment rules
2. Parallelism defined in the `--parallel` flag in your command
3. Parallelism defined in your `nx.json` file (`parallel: 3`)

If none of these methods of configuring parallelism are used, the parallelism of executed tasks will default to `1`.

Note that there are two special cases for parallelism with assignment rules where the behaviour may differ.

1. All tasks that are marked as `non-cacheable` (they are configured with `cache: false`) will be run with a parallelism of `1` regardless of the parallelism defined in the assignment rules or execution. This is usually the case with tasks such as `e2e-ci` which may requires each process to have its own environment or resources to run.
2. Assignment rules only apply to distributed executions (DTE). If you want to run multiple tasks in parallel without DTE (via the `--no-dte` flag), you will need to use the `--parallel` flag in your commands.

```shell
nx affected -t lint test built --no-dte --parallel=3
```

#### Assignment Rules Parallelism Example

```shell {% fileName=".github/workflows/ci.yaml" %}
nx affected -t lint test build --parallel=3
```

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules
  - targets:
    - lint
    - test
    run-on:
      - agent: linux-medium
        parallelism: 4

  - target:
    - build
    run-on:
      - agent: linux-large
```

In the above example, the `lint` and `test` targets will run on `linux-medium` agents with a parallelism of `4` as defined within the rules. The `build` target will run on `linux-large` agents, but note that there is no parallelism defined for that target. The parallelism for `build` tasks will then use the value provided by the `--parallel` flag, which is `3`.

#### Setting Default Parallelism for Multiple Tasks

Putting globs and parallelism together, you can set a default parallelism for all tasks within your executions. Take the following statement:

> Only `e2e-ci` tasks should run on large agents. All other tasks should run on medium agents with a parallelism of 5.

This can be represented as the following yaml config.

```yaml
assignment-rules:
  # Since this rule was defined first and `targets` has a higher precedence order,
  # e2e-ci tasks will use this rule
  - targets:
      - e2e-ci*
    run-on:
      - agent: linux-large

  # This rule will match all projects in your workspace
  - projects:
      - '*'
    run-on:
      - agent: linux-medium
        parallelism: 5
```

## Assignment Rule Precedence

Having multiple assignment rules means that often rules may overlap or apply to the same tasks. For a given task, only one rule will ever be applied. To determine which rule take priority, a rule of thumb is that **more specific rules take precedence over more general rules**. You can consult our precedence chart for a full list of rule priorities. A checkmark indicates that a rule has a particular property defined.

If two rules have the same priority based on the below chart, the rule that appears first in the `assignment-rules` list will take precedence.

| Priority | Configuration | Target | Project |
| :------: | :-----------: | :----: | :-----: |
|    1     |      ✅︎      |  ✅︎   |   ✅︎   |
|    2     |      ✅︎      |  ✅︎   |         |
|    3     |      ✅︎      |        |   ✅︎   |
|    4     |               |  ✅︎   |   ✅︎   |
|    5     |      ✅︎      |        |         |
|    6     |               |  ✅︎   |         |
|    7     |               |        |   ✅    |

### Rule Precedence Example

In this example, the task defined below can match multiple assignment rules. However, since the second rule specifies all three properties (`projects`, `targets`, and `configurations`) rather than just two (`projects` and `targets`), it takes precedence, and we automatically apply the second rule when distributing the task.

```json {% fileName="A task from your workspace" %}
{
  "project": "app1",
  "target": "build",
  "configuration": "production"
}
```

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
assignment-rules:
  # A task for app1:build:production will use this rule because it is more
  # specific (matches all three properties instead of just two)
  - projects:
      - app1
    targets:
      - build
    configurations:
      - production
    run-on:
      - agent: linux-medium-js
        parallelism: 5

  - projects:
      - app1
    targets:
      - build
    run-on:
      - agent: linux-large-js
        parallelism: 3
```

## Using Assignment Rules with Manual DTE

A typical `assignment-rules.yaml` file might look like this:

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules:
  - projects:
      - app1
    targets:
      - build
    configurations:
      - production
    run-on:
      - agent: linux-medium
        parallelism: 5
      - agent: linux-large

  - targets:
      - lint
    runs-on:
      - agent: linux-medium

  - configurations:
      - development
    run-on:
      - agent: linux-medium
      - agent: linux-large
```

Note that the agent types supplied in the `run-on` property will be used to determine which agents will have rules applied to them.
You can choose to name your agent types anything you want, but they must be set on your agents via the `NX_AGENT_LAUNCH_TEMPLATE` environment variable.

You can then reference your assignment rules file within your `start-ci-run` command:

```shell
npx nx-cloud start-ci-run --distribute-on="manual" --assignment-rules=".nx/workflows/assignment-rules.yaml"
```

The following is an example of what this looks like within a Github Actions pipeline:

```yaml {% fileName=".github/workflows/ci.yaml" %}
---
jobs:
  main:
    name: Main Job
    runs-on: ubuntu-latest
    steps:
      - ... # setup steps for your main job

      - run: npx nx-cloud start-ci-run --distribute-on="manual" --assignment-rules=".nx/workflows/assignment-rules.yaml" --stop-agents-after="e2e-ci"

      - ... # Nx commands you want to distribute

  medium-agents:
    name: Agents ${{ matrix.agent }}
    runs-on:
      group: medium-agents
    strategy:
      matrix:
        agent: [1, 2, 3]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - ... # other setup steps you may need

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Start Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
        env:
          NX_AGENT_NAME: ${{ matrix.agent }}
          NX_AGENT_LAUNCH_TEMPLATE: 'linux-medium' # This value needs to match one of the 'runs-on' values defined in the assignment rules

  large-agents:
    name: Agents ${{ matrix.agent }}
    runs-on:
      group: large-agents
    strategy:
      matrix:
        agent: [1, 2, 3]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - ... # other setup steps you may need

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Start Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
        env:
          NX_AGENT_NAME: ${{ matrix.agent }}
          NX_AGENT_LAUNCH_TEMPLATE: 'linux-large' # This value needs to match one of the 'runs-on' values defined in the assignment rules
```

## Using Assignment Rules with Dynamic Nx Agents

A typical `distribution-config.yaml` file might look like this:

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  default: 5 linux-medium-js, 5 linux-large-js

assignment-rules:
  - projects:
      - app1
    targets:
      - build
    configurations:
      - production
    run-on:
      - agent: linux-large-js

  - targets:
      - lint
    run-on:
      - agent: linux-medium-js
        parallelism: 3

  - configurations:
      - development
    run-on:
      - agent: linux-medium-js
      - agent: linux-large-js
```

You can then reference your distribution configuration in your CI pipeline configuration:

```yaml {% fileName=".github/workflows/main.yaml" highlightLines=[8] %}
...
jobs:
  - job: main
    name: Main Job
    ...
    steps:
      ...
      - run: npx nx-cloud start-ci-run --distribute-on=".nx/workflows/distribution-config.yaml" --stop-agents-after="e2e-ci"
      - ..
```

### More Examples of Assignment Rules with Dynamic Agents

#### Invalid Assignment Rules Example

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  # Invalid changeset that is missing `linux-large-js`. Tasks assigned to large agents won't be able to execute.
  small-changeset: 1 linux-small-js, 2 linux-medium-js
  medium-changeset: 2 linux-small-js, 2 linux-medium-js, 3 linux-large-js
  large-changeset: 3 linux-small-js, 3 linux-medium-js, 4 linux-large-js

assignment-rules:
  # Missing one of `projects`, `targets`, `configurations`
  - run-on:
      - agent: linux-medium-js
        parallelism: 1
      - agent: linux-large-js
        parallelism: 3

  # Missing `runs-on`
  - targets:
      - lint
    configurations:
      - production

  # Agent type not found in any of the `distribute-on` changesets
  - projects:
      - lib1
    targets:
      - test
    run-on:
      - agent: linux-extra-large-js
```

#### Valid Assignment Rules Example

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  default: 3 linux-small-js, 2 linux-medium-js, 1 linux-large-js

# All rules below are valid assignment rules
assignment-rules:
  - projects:
      - app1
    run-on:
      - agent: linux-medium-js
      - agent: linux-large-js

  - targets:
      - lint
    configurations:
      - production
    run-on:
      - agent: linux-large-js
        parallelism: 10

  - projects:
      - lib1
    targets:
      - test
    run-on:
      - agent: linux-medium-js
```

## Deprecated Assignment Rules

Assignment rules used to be defined with the following schema. However, this schema did not support multi-glob matching, nor parallelism. Rules defined in this format will still work, but we recommend updating them to the new schema.

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
# We recommend updating your assignment rules to the most recent schema
assignment-rules:
  - project: app1 # replaced by `projects`
    target: e2e-ci* # replaced by `targets`
    configuration: production # replaced by `configurations`
    runs-on: # replaced by `run-on`
      - linux-medium-js
      - linux-large-js
```
