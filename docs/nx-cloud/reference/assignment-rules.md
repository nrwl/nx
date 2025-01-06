# Assignment Rules (beta)

Assignment rules allow you to control which tasks can run on which agents. Save on agent costs by provisioning different sizes of agents all with the confidence that your tasks will be run on the agents that are best suited for them. You can ensure resource intensive targets like `e2e-ci` and `build` have what they need by using larger agents. Lighter tasks like `lint` and `test` can run on smaller agents.

Assignment rules are defined in `yaml` files within your workspace's `.nx/workflows` directory. You can use assignment rules with self-hosted agents or with [dynamic Nx agents](/ci/features/dynamic-agents). Note that the additional configuration is required when using self-hosted agents.

## How to Define an Assignment Rule

Each assignment rule has one of the following properties that it matches against tasks: `project`, `target`, and/or `configuration`. It also has a list of possible [agent types](/ci/reference/launch-templates) that tasks with the matching properties can run on. Rules are defined in yaml like the following:

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules:
  - project: app1
    target: build
    configuration: production
    runs-on:
      - linux-large-js
      - linux-medium-js
```

The above rule will match any task that has a project named `app1`, a target named `build`, and a configuration named `production`. Any tasks that match this rule will only be allowed to run on agents with the `linux-large-js` and `linux-medium-js` launch templates.

You can mix and match any of the criteria in an assignment rule provided that you follow the constraints:

- At least one of the following properties is defined: `project`, `target`, `configuration`.
- There is at least one [agent type](/ci/reference/launch-templates) specified in the `run-on` field.
- Every changeset in your `distribute-on` field must include at **least one agent** that matches each agent type specified in the run-on field across all assignment rules. For example, if your rules distribute tasks on `linux-small-js`, `linux-medium-js`, and `linux-large-js`, then at least one agent of each type must be available; otherwise, tasks associated with those rules cannot be executed.

## Assignment Rule Precedence

Having multiple assignment rules means that often rules may overlap or apply to the same tasks. To determine which rule take priority, a rule of thumb is that **more specific rules take precedence over more general rules**. You can consult our precedence chart for a full list of rule priorities. A checkmark indicates that a rule has a particular property defined.

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

In this example, the task defined below can match multiple assignment rules. However, since the second rule specifies all three properties (`project`, `target`, and `configuration`) rather than just two (`project` and `target`), it takes precedence, and we apply the second rule when distributing the task.

```json {% fileName="A task from your workspace" %}
{
  "project": "app1",
  "target": "build",
  "configuration": "production"
}
```

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
assignment-rules:
  - project: app1
    target: build
    configuration: production
    runs-on:
      - linux-medium-js

  - project: app1
    target: build
    runs-on:
      - linux-large-js
```

## Using Assignment Rules with Self-Hosted Agents

A typical `assignment-rules.yaml` file might look like this:

```yaml {% fileName=".nx/workflows/assignment-rules.yaml" %}
assignment-rules:
  - project: app1
    target: build
    configuration: production
    runs-on:
      - linux-large
      - linux-medium

  - target: lint
    runs-on:
      - linux-medium

  - configuration: development
    runs-on:
      - linux-medium
      - linux-large
```

Note that the labels supplied in the `runs-ons` property will be used to determine which agents will have rules applied to them. When using self-hosted agents, you must supply these labels to your agents via an environment variable: `NX_AGENT_LAUNCH_TEMPLATE`.

You can then reference your assignment rules file within your `start-ci-run` command:

```shell
npx nx-cloud start-ci-run --assignment-rules=".nx/workflows/assignment-rules.yaml"
```

The following is an example of what this looks like within a github actions pipeline:

```yaml {% fileName=".github/workflows/ci.yaml" %}
...
jobs:
  main:
    name: Main Job
    ...
    steps:
      ...
      - run: npx nx-cloud start-ci-run --assignment-rules=".nx/workflows/assignment-rules.yaml" --stop-agents-after="e2e-ci"
      - ..

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

      - name: Install dependencies
        run: npm ci

      ...

      - name: Start Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
        env:
          NX_AGENT_NAME: ${{ matrix.agent }}
          NX_AGENT_LAUNCH_TEMPLATE: "linux-medium" # This value needs to match one of the 'runs-on' values defined in the assignment rules

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

      - name: Install dependencies
        run: npm ci

      ... # other setup steps

      - name: Start Agent ${{ matrix.agent }}
        run: npx nx-cloud start-agent
        env:
          NX_AGENT_NAME: ${{ matrix.agent }}
          NX_AGENT_LAUNCH_TEMPLATE: "linux-large" # This value needs to match one of the 'runs-on' values defined in the assignment rules
```

## Using Assignment Rules with Dynamic Nx Agents

A typical `distribution-config.yaml` file might look like this:

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js, 2 linux-large-js
  medium-changeset: 6 linux-medium-js, 4 linux-large-js
  large-changeset: 10 linux-medium-js, 8 linux-large-js

assignment-rules:
  - project: app1
    target: build
    configuration: production
    runs-on:
      - linux-large-js

  - target: lint
    runs-on:
      - linux-medium-js

  - configuration: development
    runs-on:
      - linux-medium-js
      - linux-large-js
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
  # Missing one of `project`, `target`, `configuration`
  - runs-on:
      - linux-medium-js
      - linux-large-js

  # Missing `runs-on`
  - target: lint
    configuration: production

  # Agent type not found in any of the `distribute-on` changesets
  - project: lib1
    target: test
    runs-on:
      - linux-extra-large-js
```

#### Valid Assignment Rules Example

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  default: 3 linux-small-js, 2 linux-medium-js, 1 linux-large-js

# All rules below are valid assignment rules
assignment-rules:
  - project: app1
    runs-on:
      - linux-medium-js
      - linux-large-js

  - target: lint
    configuration: production
    runs-on:
      - linux-large-js

  - project: lib1
    target: test
    runs-on:
      - linux-medium-js
```
