# Affected

> Before reading this guide, check out the [mental model guide](/using-nx/mental-model). It will help you understand how computation caching fits into the rest of Nx.

## Overview

When you run `nx test app1`, you are telling Nx to run the app1:test task plus all the tasks it depends on.

When you run `nx run-many --target=test --projects=app1,lib`, you are telling Nx to do the same for two tasks app1:test
and lib:test.

When you run `nx run-many --target=test --all`, you are telling Nx to do this for all the projects.

As your workspace grows, retesting all projects becomes too slow. To address this Nx implements code change analysis to
get the min set of projects that need to be retested. How does it work?

When you run `nx affected --target=test`, Nx looks at the files you changed in your PR, it will look at the nature of
change (what exactly did you update in those files), and it uses this to figure the list of projects in the workspace
that can be affected by this change. It then runs the `run-many` command with that list.

For instance, if my PR changes `lib`, and I then run `nx affected --target=test`, Nx figures out that `app1` and `app2`
depend on `lib`, so it will invoke `nx run-many --target=test --projects=app1,app2,lib`.

![affected](/shared/mental-model/affected.png)

Nx analyzes the nature of the changes. For example, if you change the version of Next.js in the package.json, Nx knows
that `app2` cannot be affected by it, so it only retests `app1`.

## Dep Graph

To visualise what is affected, run:

```bash
nx affected:dep-graph
```

## CI

The SHAs you pass must be defined in the git repository. The `main` and `HEAD` SHAs are what you normally use while developing. Most likely you will want to provision other SHAs in your CI environment.

```bash
nx affected:build --base= origin/main --head=$PR_BRANCH_NAME # where PR_BRANCH_NAME is defined by your CI system
nx affected:build --base= origin/main~1 --head= origin/main # rerun what is affected by the last commit in main
```

You can also set the base and head SHAs as env variables:

```bash
NX_BASE=origin/main~1
NX_HEAD=origin/main
```

## Ignoring Files from Affected Commands

Nx provides two methods to exclude glob patterns (files and folders) from `affected:*` commands.

- Glob patterns defined in your `.gitignore` file are ignored.
- Glob patterns defined in an optional `.nxignore` file are ignored.

## Not Using Git

If you aren't using Git, you can pass `--files` to any affected command to indicate what files have been changed.
