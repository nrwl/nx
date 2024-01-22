# Nx Agents: The Next Leap in Distributed Task Execution

{% callout type="note" title="Early Preview Doc - Subject to Change" %}
**Early Preview of Nx Agents:** This is a work-in-progress feature, with a public launch anticipated in Feb 2024. Keep an eye on this document for continuous updates. Interested in early access? [Sign up here](https://go.nx.dev/nx-agents-ea).
{% /callout %}

{% youtube
src="https://youtu.be/XLOUFZeqRpM"
title="Nx Agents in action splitting e2e tests at a file level"
 /%}

Nx Agents represent the next evolution of [Nx Cloud's Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), bringing a new level of efficiency and simplicity to your CI/CD pipelines. It takes away the complexity of configuring agents and comes with features such as scaling of agents based on the PR, flaky task re-running, and intelligent task splitting and distribution. Keep reading to learn more.

Currently in private beta, Nx Agents are slated for public release in February 2024. Don't miss the opportunity to be among the first to experience this groundbreaking tool. Sign up now for early access.

{% call-to-action title="Sign Up for Early Access" icon="nxcloud" description="Experience Nx Agents for yourself" url="https://go.nx.dev/nx-agents-ea" /%}

## What's the Difference to DTE?

Nx Cloud's [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution) introduced an easy way to intelligently distribute tasks across machines, allowing for a more fine-grained distribution taking historical data as well as the task dependencies into account.

Using DTE you have to configure and instantiate your agents, which might be more or less complex depending on your CI provider. We have some guides on how to do that [here](/ci/recipes/set-up).

![Diagram showing Nx Cloud distributing tasks to multiple agents on your CI provider](/shared/images/dte/distributed-caching-and-task-execution.svg)

Nx Agents take away that complexity by delegating the agent management to Nx Cloud. You can think of them as a managed version of DTE.

![Diagram showing Nx Cloud distributing tasks to multiple Nx Agents](/shared/images/dte/distributed-task-execution-on-workflows.svg)

Keep reading to learn what the configuration and setup looks like.

## Managed Agents, Seamless Configuration

Enabling task distribution with Nx Agents can be done in a single line. Simply add the `--distribute-on` property to the `start-ci-run` line in your CI pipeline configuration:

```yaml
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distributes-on="8 linux-medium-js"'
  ...
```

This instructs Nx Cloud to distribute tasks across 8 agents of type `linux-medium-js`. `linux-medium-js` is the name of the launch template that will be used to provision the agent. The default launch templates [can be found here](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml) (there will be more once Nx Agents is publicly available).

You can also define your own "launch templates" (here's an [example from the Nx repo](https://github.com/nrwl/nx/blob/master/.nx/workflows/agents.yaml)):

```yaml
# .nx/workflows/agents.yaml
launch-templates:
  linux-medium:
    resource-class: 'docker_linux_amd64/medium+'
    env:
      CI: 'true'
      GIT_AUTHOR_EMAIL: test@test.com
      ...
      NX_CLOUD_ACCESS_TOKEN: '{{secrets.NX_CLOUD_ACCESS_TOKEN}}'
    init-steps:
	    ...
      - name: Install Pnpm
        script: |
          npm install -g @pnpm/exe@8.7.4

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
--distributes-on="8 linux-medium-js"
```

...which always runs tasks on the same amount of machines, you can also have Nx Cloud scale the number of agents based on the size of your PR.

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distributes-on:
  small-changeset: 1 linux-medium
  medium-changeset: 6 linux-medium
  large-changeset: 10 linux-medium
```

{% callout type="note" title="How is the size of the PR determined?" %}
To determine the size of the PR, Nx Cloud calculates the relationship between the number of [affected projects](/ci/features/affected) and the total number of projects in the workspace. It then assigns it to one of the three categories: small, medium, or large. This calculation is static right now but might be configurable once Nx Agents is publicly available.
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
      - run: npx nx-cloud start-ci-run --distributes-on=".nx/workflows/dynamic-changesets.yaml" --stop-agents-after="e2e-wrapper"
      - ...
```

## Automatic Task Splitting

Imagine you're working on an end-to-end (e2e) project using tools like Cypress or Playwright. Traditionally, to make the most of features like [affected](/ci/features/affected), [caching](/ci/features/remote-cache), and [distribution](/ci/features/distribute-task-execution), you'd need to divide your project into smaller parts. But this approach can often be cumbersome and less efficient for developers.

Nx is on the verge of introducing a game-changing feature that enables dynamic target definitions for projects (more details to come). Paired with Nx Agents, this innovation allows you to distribute e2e tests at the file level across various agents.

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

As a result, if Nx Cloud has marked a task as flaky, it will be automatically retried, ideally on a different Nx Agent to prevent issues from any residues of earlier runs.

---

Sign up now for early access and be one of the first to try Nx Agents.

{% call-to-action title="Sign Up for Early Access" icon="nxcloud" description="Experience Nx Cloud Agents for yourself" url="https://go.nx.dev/nx-agents-ea" /%}
