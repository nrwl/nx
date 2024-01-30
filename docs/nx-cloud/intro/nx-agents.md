# Distribute Task Execution (Nx Agents)

{% youtube
src="https://youtu.be/XLOUFZeqRpM"
title="Nx Agents in action splitting e2e tests at a file level"
 /%}

**Nx Agents** lets you distribute your CI across many machines without adding any configuration to your workspace.  It comes with features such as scaling of agents based on the PR, flaky task re-running, and intelligent task splitting and distribution. Keep reading to learn more.

## Enabling Nx Agents

Enabling task distribution with Nx Agents can be done in a single line. Simply add the `--distribute-on` property to the `start-ci-run` line in your CI pipeline configuration:

```yaml
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js"'
  ...
```

This instructs Nx Cloud to distribute tasks across 8 agents of type `linux-medium-js`. `linux-medium-js` is the name of the launch template that will be used to provision the agent. The default launch templates [can be found here](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml) 

You can also define your own "launch templates" (here's an [example from the Nx repo](https://github.com/nrwl/nx/blob/master/.nx/workflows/agents.yaml)):

```yaml
# .nx/workflows/agents.yaml
launch-templates:
  linux-medium:
    resource-class: 'docker_linux_amd64/medium+'
    init-steps:
      - name: Pnpm Install
        script: |
          pnpm install --frozen-lockfile

      - name: Install Cypress
        script: pnpm exec cypress install

      - name: Install Rust
      - ...
```

Here are the [available resource classes](https://nx.app/pricing#resource-classes).

## Intelligent Dynamic Scaling

Instead of defining

```
--distribute-on="8 linux-medium-js"
```

...which always runs tasks on the same amount of machines, you can also have Nx Cloud scale the number of agents based on the size of your PR.

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 1 linux-medium-js
  medium-changeset: 6 linux-medium-js
  large-changeset: 10 linux-medium-js
```

{% callout type="note" title="How is the size of the PR determined?" %}
To determine the size of the PR, Nx Cloud calculates the relationship between the number of [affected projects](/ci/features/affected) and the total number of projects in the workspace. It then assigns it to one of the three categories: small, medium, or large. 
{% /callout %}

You can then reference it in your CI pipeline configuration:

```yaml {% fileName=".github/workflows/main.yaml" %}
...
jobs:
  - job: main
    displayName: Main Job
    ...
    steps:
      - checkout
      - run: npx nx-cloud start-ci-run --distribute-on=".nx/workflows/dynamic-changesets.yaml" --stop-agents-after="e2e-ci"
      - ...
```

## Automatic Task Splitting

Imagine you're working on an end-to-end (e2e) project using tools like Cypress or Playwright. Traditionally, to make the most of features like [affected](/ci/features/affected), [caching](/ci/features/remote-cache), and [distribution](/ci/features/distribute-task-execution), you'd need to divide your project into smaller parts. But this approach can often be cumbersome and less efficient for developers.

Nx 18 in combination with Nx Agents is able to split your e2e target into multiple smaller targets that can be distributed across machines. `e2e-ci` targets does the splitting, where as `e2e` will run all the tests in the same projects together, as part of the same target.

This significantly cuts down the time required to run e2e tests. For instance, in the video shown at the beginning of the page, e2e test durations plummeted from 90 minutes to just 10 minutes.

## Flaky Task Re-Running: Enhancing Reliability

Flaky tasks are a common headache, particularly with tests and end-to-end (e2e) tests. Nx Agents offer a solid solution to detect and automatically retry such unreliable tasks.

Nx Cloud keeps track of the targets being executed. A task, like `myapp:e2e`, is labeled as flaky **if it shows different outcomes (status codes) for the same cache hash key**. This key is an ideal task identifier, encompassing the command, environment variables, source files, and more.

Consider this scenario:

- An Nx agent runs `myapp:e2e`.
- Nx calculates the cache hash key for this task.
- **`myapp:e2e` fails**; Nx Cloud notes this failure along with the cache key.
- In a subsequent run, `myapp:e2e` is executed again.
- Nx recalculates the cache hash key, which matches the previous run's key (no existing cache since the initial task failed).
- This time, `myapp:e2e` **succeeds**.
- Nx Cloud identifies the task as flaky and stores this data temporarily.

As a result, if Nx Cloud has marked a task as flaky, it will be automatically retried, on a different Nx Agent to prevent issues from any residues of earlier runs.
