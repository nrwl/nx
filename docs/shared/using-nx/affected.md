# Run Only Tasks Affected by a PR

As your workspace grows, re-testing, re-building an re-linting all projects becomes too slow. To address this Nx implements code change analysis to determine the minimum set of projects that were affected by the change. How does this work?

```shell
nx affected -t <task>
```

When you run `nx affected -t test`, Nx uses Git to determine the files you changed in your PR, it will look at the nature of
change (what exactly did you update in those files), and it uses this to determine the list of projects in the workspace
that can be affected by this change. It then runs the `run-many` command with that list.

For instance, if my PR changes `lib`, and I then run `nx affected -t test`, Nx figures out that `app1` and `app2`
depend on `lib`, so it will invoke `nx run-many -t test -p app1 app2 lib`.

{% side-by-side %}
{% graph title="Changing app1 can only affect app1" height="250px" %}

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
      "name": "lib",
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
        "target": "lib",
        "source": "app1",
        "type": "direct"
      }
    ],
    "app2": [
      {
        "target": "lib",
        "source": "app2",
        "type": "direct"
      }
    ],
    "lib": []
  },
  "affectedProjectIds": ["app1"]
}
```

{% /graph %}

{% graph title="Changing lib can affect lib, app1 and app2" height="250px" %}

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
      "name": "lib",
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
        "target": "lib",
        "source": "app1",
        "type": "direct"
      }
    ],
    "app2": [
      {
        "target": "lib",
        "source": "app2",
        "type": "direct"
      }
    ],
    "lib": []
  },
  "affectedProjectIds": ["app1", "app2", "lib"]
}
```

{% /graph %}
{% /side-by-side %}

Nx analyzes the nature of the changes. For example, if you change the version of Next.js in the package.json, Nx knows
that `app2` cannot be affected by it, so it only retests `app1`.

## Visualize Affected Projects

To visualize what is affected, run:

```shell
nx affected:graph
```

## Specify Which SHAs to Use to Calculate Affected Code

The SHAs you pass must be defined in the git repository. The `main` and `HEAD` SHAs are what you normally use while developing. Most likely you will want to provision other SHAs in your CI environment.

```shell
nx affected:build --base=origin/main --head=$PR_BRANCH_NAME # where PR_BRANCH_NAME is defined by your CI system
nx affected:build --base=origin/main~1 --head=origin/main # rerun what is affected by the last commit in main
```

You can also set the base and head SHAs as env variables:

```shell
NX_BASE=origin/main~1
NX_HEAD=origin/main
```

Typically, you want to set the base SHA not the the most recent commit on the `main` branch, but rather that latest commit that successfully passed in CI. In other words, in order to be certain that the repo is in a good state, we need to check all the changes that have happened since the last time the repo was in a good state. See the setup guide for your CI provider to learn how to calculate the last successful commit.

## Ignoring Files from Affected Commands

Nx provides two methods to exclude glob patterns (files and folders) from `affected:*` commands.

- Glob patterns defined in your `.gitignore` file are ignored.
- Glob patterns defined in an optional `.nxignore` file are ignored.

## Not Using Git

If you aren't using Git, you can pass `--files` to any affected command to indicate what files have been changed.
