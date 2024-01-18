# Automatically Split E2E Tasks by File

In almost every codebase, e2e tests are the largest portion of the CI pipeline. Typically, e2e tests are grouped by application so that whenever an application's code changes, all the e2e tests for that application are run. These large groupings of e2e tests make caching and distribution less effective. Also, because e2e tests deal with a lot of integration code, they are at a much higher risk to be flaky.

You could manually address these problems by splitting your e2e tests into smaller tasks, but this requires developer time to maintain and adds additional configuration overhead to your codebase. Or, you could allow Nx to automatically split your Cypress or Playwright e2e tests by file.

## Set up

To enable automatically split e2e tasks, you need to turn on [inferred tasks](/concepts/inferred-tasks) for the [@nx/cypress](/nx-api/cypress) or [@nx/playwright](/nx-api/playwright) plugins. Run this command to set up inferred tasks:

{% tabs %}
{% tab label="Cypress" %}

```shell
nx add @nx/cypress
```

{% /tab %}
{% tab label="Playwright" %}

```shell
nx add @nx/playwright
```

{% /tab %}
{% /tabs %}

This command will register the appropriate plugin in the `plugins` array of `nx.json`.

## Usage

You can view the available tasks in the graph:

```shell
nx graph
```

You'll see that there are tasks named `e2e`, `e2e-ci` and a task for each e2e test file.

Developers can run all e2e tests locally the same way as usual:

```shell
nx e2e my-project-e2e
```

You can update your CI pipeline to run `e2e-ci`, which will automatically run all the inferred tasks for the individual e2e test files. Run it like this:

```shell
nx e2e-ci my-project-e2e
```

## Benefits

Smaller e2e tasks enable the following benefits:

- Nx's cache can be used for all the e2e tasks that succeeded and only the failed tasks need to be re-run
- Distributed Task Execution allows your e2e tests to be run on multiple machines simultaneously, which reduces the total time of the CI pipeline
- Nx Agents can [automatically re-run failed flaky e2e tests](/ci/concepts/flaky-tasks) on a separate agent without a developer needing to manually re-run the CI pipeline
