# Run Only Tasks Affected by a PR

As your workspace grows, re-testing, re-building and re-linting all projects becomes too slow. To address this Nx implements code change analysis to determine the minimum set of projects that were affected by the change. How does this work?

```shell
nx affected -t <task>
```

When you run `nx affected -t test`, Nx uses Git to determine the files you changed in your PR, it will look at the nature of
change (what exactly did you update in those files), and it uses this to determine the list of projects in the workspace
that can be affected by this change. It then runs the `run-many` command with that list.

For instance, if my PR changes `lib10`, and we then run `nx affected -t test`, Nx leverages the project graph to determine all the projects that depend on `lib10`, marks them as "affected" and runs `test` on just that subset of projects.

{% graph title="Making a change in lib10 only affects a sub-part of the project graph" height="400px" %}

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

## Visualize Affected Projects

You can also visualize the affected projects using the [Nx graph](/features/explore-graph). Simply run:

```shell
nx affected:graph
```

## Specify Which SHAs to Use to Calculate Affected Code

To understand which projects are affected, Nx uses the Git history and the [project graph](/features/explore-graph). Git knows which files changed, and the Nx project graph knows which projects those files belong to.

The affected command takes a `base` and `head` commit. The default `base` is your `main` branch and the default `head` is your current file system. This is generally what you want when developing locally, but in CI, you need to customize these values.

```shell
nx affected:build --base=origin/main --head=$PR_BRANCH_NAME # where PR_BRANCH_NAME is defined by your CI system
nx affected:build --base=origin/main~1 --head=origin/main # rerun what is affected by the last commit in main
```

You can also set the base and head SHAs as env variables:

```shell
NX_BASE=origin/main~1
NX_HEAD=origin/main
```

Typically, you want to set the base SHA not the most recent commit on the `main` branch, but rather that latest commit that successfully passed in CI. In other words, in order to be certain that the repo is in a good state, we need to check all the changes that have happened since the last time the repo was in a good state. Depending on your CI provider this might differ:

- [Get last successful commit for Azure Pipelines](/ci/recipes/set-up/monorepo-ci-azure#get-the-commit-of-the-last-successful-build)
- [Get last successful commit for GitHub Actions](/ci/recipes/set-up/monorepo-ci-github-actions#get-the-commit-of-the-last-successful-build)
- [Get last successful commit for CircleCI](/ci/recipes/set-up/monorepo-ci-circle-ci#get-the-commit-of-the-last-successful-build)
- [Get last successful commit for GitLab](/ci/recipes/set-up/monorepo-ci-gitlab)
- [Get last successful commit for Jenkins](/ci/recipes/set-up/monorepo-ci-jenkins#get-the-commit-of-the-last-successful-build)

## Ignoring Files from Affected Commands

Nx provides two methods to exclude glob patterns (files and folders) from `affected:*` commands.

- Glob patterns defined in your `.gitignore` file are ignored.
- Glob patterns defined in an optional `.nxignore` file are ignored.

## Not Using Git

If you aren't using Git, you can pass `--files` to any affected command to indicate what files have been changed.
