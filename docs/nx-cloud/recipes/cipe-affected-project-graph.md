# Reduce the Number of Affected Projects in a CI Pipeline Execution

When it comes to troubleshooting long-running CI pipeline executions, there are different tools available to help you identify the potential issues. One such tool is the **Affected Project Graph** feature on the CI Pipeline Execution page.

## Getting to the CI Pipeline Execution Affected Project Graph

To access the affected project graph for the CI pipeline execution, navigate to the CI pipeline execution details page and click on the **Affected Project Graph** navigation item.

![CIPE Affected Project Graph](/nx-cloud/recipes/cipe-affected-project-graph-nav-item.png)

The affected project graph visualizes the projects that are part of the **current** CI pipeline execution.

## Identifying a Potential Over-run of a CI Pipeline Execution

In this recipe, we will walk through a scenario where the affected project graph can be used to identify a potential over-run of a CI pipeline execution.

This is our repository structure:

```text
apps/
├── web
├── web-e2e
├── nx-graph-test
├── nx-graph-test-e2e
└── recipes/
    ├── client
    └── client-e2e
libs/
├── ui (button and icon components)
├── forms/
│   └── input
└── tooltip
```

Our most recent CI pipeline execution affects everything in the repository.

![CIPE Affected Project Graph -- every tasks](/nx-cloud/recipes/cipe-affected-project-graph-every-tasks.png)

Likewise, the affected project graph for the Ci pipeline execution also visualizes all projects because everything is affected.

![CIPE Affected Project Graph -- affect everything](/nx-cloud/recipes/cipe-affected-project-graph-every-projects.png)

## Create a New CI Pipeline Execution with a Code Change

Our `ui` library has 2 components: `button` and `tooltip`. From the graph, we can see that both our apps `client` and `web` depend on the `ui` library: `client` uses the `tooltip` component and `web` uses the `button` component.

Let's make an update to the `tooltip` component and see how it affects our next CI pipeline execution. Pushing this change to our repository will trigger a new CI pipeline execution.

![CIPE Affected Project Graph -- new CIPE](/nx-cloud/recipes/cipe-affected-project-graph-tooltip-tasks.png)

This CI pipeline execution contains 14 tasks that are affected by the change we made to the `tooltip` component.

![CIPE Affected Project Graph -- new CIPE tasks](/nx-cloud/recipes/cipe-affected-project-graph-tooltip-affected.png)

The affected project graph also shows that the change to `tooltip` component , which is part of the `ui` library, affects both the `client` and `web` apps.

At this point, we can ask ourselves that "Should a change to the `tooltip` component affect both the `client` and `web` apps or should it only affect the `web` app?" Our goal should be to always have the most efficient CI pipeline executions possible. Decreasing the number of affected projects will allow the number of tasks to be reduced, which will reduce the overall CI pipeline execution time.

## Break Up the Source of the Affected Projects

To achieve our goal, we can break up the `ui` library into 2 separate libraries: `button` and `tooltip`.

> Check out our [blog post](/blog/improve-architecture-and-ci-times-with-projects) about splitting large projects into smaller ones.

Once we have done this, we will end up with the following project graph:

![CIPE Affected Project Graph -- break up ui](/nx-cloud/recipes/cipe-affected-project-graph-break-up-ui.png)

Let's make a change to the `button` component this time and see how it affects our next CI pipeline execution.

![CIPE Affected Project Graph -- button tasks](/nx-cloud/recipes/cipe-affected-project-graph-button-tasks.png)

We've reduced the number of affected tasks from 14 to 8.

![CIPE Affected Project Graph -- button affected](/nx-cloud/recipes/cipe-affected-project-graph-button-affected.png)

And the affected project graph also reflects that change properly.

{% callout type="info" title="Does your Affected Project Graph only show affected projects and not touched?" %}

- If your commit has changes to one of the global inputs, your projects will be affected but no specific project is touched directly.
- Make sure you are calling `start-ci-run` to start using Nx Agents for touched projects to be recorded. Learn more about [Nx Agents](/ci/features/distribute-task-execution)

{% /callout %}
