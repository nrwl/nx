---
title: Run Only Tasks Affected by a PR
description: Learn how to use Nx's affected command to determine and run tasks only on projects affected by your changes, improving CI speed and efficiency.
---

# Run Only Tasks Affected by a PR

{% youtube
src="https://youtu.be/q-cu5Lw3DoE"
title="Only Run Tasks for Projects That Changed"
 /%}

As your workspace grows, re-testing, re-building, and re-linting **all projects becomes too slow**. To address this, Nx comes with an "affected" command. Using this command, Nx

- determines the minimum set of **projects that are affected by the change**
- only runs tasks on those affected projects

This drastically improves the speed of your CI and reduces the amount of compute needed. This advantage is further enhanced when [paired with remote caching and distribution](#best-paired-with-remote-caching-and-distribution).

{% graph title="Making a change in lib10 only affects a sub-part of the project graph (shown in purple)" height="400px" %}

```json
{
  "projects": [
    {
      "type": "app",
      "name": "app1",
      "data": {}
    },
    {
      "type": "app",
      "name": "app2",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib1",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib2",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib3",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib4",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib5",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib6",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib7",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib8",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib9",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib10",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib11",
      "data": {}
    },
    {
      "type": "lib",
      "name": "lib12",
      "data": {}
    }
  ],
  "groupByFolder": false,
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "dependencies": {
    "app1": [
      {
        "target": "lib1",
        "source": "app1",
        "type": "direct"
      },
      {
        "target": "lib2",
        "source": "app1",
        "type": "direct"
      }
    ],
    "app2": [
      {
        "target": "lib4",
        "source": "app2",
        "type": "direct"
      },
      {
        "target": "lib5",
        "source": "app2",
        "type": "direct"
      },
      {
        "target": "lib6",
        "source": "app2",
        "type": "direct"
      }
    ],
    "lib1": [
      {
        "target": "lib7",
        "source": "lib1",
        "type": "direct"
      },
      {
        "target": "lib8",
        "source": "lib1",
        "type": "direct"
      }
    ],
    "lib2": [
      {
        "target": "lib3",
        "source": "lib2",
        "type": "direct"
      }
    ],
    "lib3": [
      {
        "target": "lib8",
        "source": "lib3",
        "type": "direct"
      }
    ],
    "lib4": [
      {
        "target": "lib3",
        "source": "lib4",
        "type": "direct"
      },
      {
        "target": "lib9",
        "source": "lib4",
        "type": "direct"
      },
      {
        "target": "lib10",
        "source": "lib4",
        "type": "direct"
      }
    ],
    "lib5": [
      {
        "target": "lib10",
        "source": "lib5",
        "type": "direct"
      },
      {
        "target": "lib11",
        "source": "lib5",
        "type": "direct"
      },
      {
        "target": "lib12",
        "source": "lib5",
        "type": "direct"
      }
    ],
    "lib6": [
      {
        "target": "lib12",
        "source": "lib6",
        "type": "direct"
      }
    ],
    "lib7": [],
    "lib8": [],
    "lib9": [],
    "lib10": [],
    "lib11": [],
    "lib12": []
  },
  "affectedProjectIds": ["lib10", "lib4", "lib5", "app2"]
}
```

{% /graph %}

## Using Nx Affected Commands

To leverage this feature, use the following command when running your tasks, particularly on CI:

```shell
nx affected -t <task>
```

When you run `nx affected -t test`, Nx will:

- Use Git to determine the files you changed in your PR.
- Use the [project graph](/features/explore-graph) to determine which projects the files belong to.
- Determine which projects depend on the projects you modified.

Once the projects are identified, Nx runs the tasks you specified on that subset of projects.

You can also visualize the affected projects using the [Nx graph](/features/explore-graph). Simply run:

```shell
nx graph --affected
```

## Best Paired with Remote Caching and Distribution

Using `nx affected` is a powerful tool to reduce the amount of compute that needs to be run. However, this might not be sufficient to significantly speed up your CI pipeline. For example:

- If you're modifying a **project that is used by a large portion** of your monorepo projects, you might end up running tasks for almost all the projects in the workspace.
- If you have a set of 10 projects affected by a PR and you continue making changes, you will **always end up running tasks for those 10 projects**. The set of affected projects doesn't change but is always calculated with respect to your last successful run on the main branch.

This is why Nx Affected is best paired with [remote caching](/ci/features/remote-cache) and [distributed task execution](/ci/features/distribute-task-execution).

## Configure Affected on CI

To understand which projects are affected, Nx uses the Git history and the [project graph](/features/explore-graph). Git knows which files changed, and the Nx project graph knows which projects those files belong to.

The affected command takes a `base` and `head` commit. The default `base` is your `main` branch, and the default `head` is your current file system. This is generally what you want when developing locally, but in CI, you need to customize these values.

```shell
nx affected -t build --base=origin/main --head=$PR_BRANCH_NAME # where PR_BRANCH_NAME is defined by your CI system
nx affected -t build --base=origin/main~1 --head=origin/main # rerun what is affected by the last commit in main
```

You can also set the base and head SHAs as environment variables:

```shell
NX_BASE=origin/main~1
NX_HEAD=origin/main
```

**The recommended approach is to set the base SHA to the latest successful commit** on the `main` branch. This ensures that all changes since the last successful CI run are accounted for.

Depending on your CI provider, this might differ:

- [Get last successful commit for Azure Pipelines](/ci/recipes/set-up/monorepo-ci-azure#get-the-commit-of-the-last-successful-build)
- [Get last successful commit for GitHub Actions](/ci/recipes/set-up/monorepo-ci-github-actions#get-the-commit-of-the-last-successful-build)
- [Get last successful commit for CircleCI](/ci/recipes/set-up/monorepo-ci-circle-ci#get-the-commit-of-the-last-successful-build)
- [Get last successful commit for GitLab](/ci/recipes/set-up/monorepo-ci-gitlab)
- [Get last successful commit for Jenkins](/ci/recipes/set-up/monorepo-ci-jenkins#get-the-commit-of-the-last-successful-build)

## Ignoring Files from Affected Commands

Nx provides two methods to exclude glob patterns (files and folders) from `affected:*` commands:

- Glob patterns defined in your `.gitignore` file are ignored.
- Glob patterns defined in an optional `.nxignore` file are ignored.

## Marking Projects Affected by Dependency Updates

By default, Nx will mark all projects as affected whenever your package manager's lock file changes. This behavior is a failsafe in case Nx misses a project that should be affected by a dependency update. If you'd like to opt into smarter behavior, you can configure Nx to only mark projects as affected if they actually depend on the updated packages.

```json {% fileName="nx.json" %}
{
  "pluginsConfig": {
    "@nx/js": {
      "projectsAffectedByDependencyUpdates": "auto"
    }
  }
}
```

The flag `projectsAffectedByDependencyUpdates` can be set to `auto`, `all`, or an array that contains project specifiers. The default value is `all`.

## Not Using Git

If you aren't using Git, you can pass `--files` to any affected command to indicate what files have been changed.
