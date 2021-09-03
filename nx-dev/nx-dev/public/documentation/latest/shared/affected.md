# Rebuilding and Retesting What is Affected

When using Nx you can build and test individual apps and libs.

```bash
nx g @nrwl/web:app client
nx g @nrwl/web:app admin
nx g @nrwl/workspace:lib client-feature-main
nx g @nrwl/workspace:lib admin-feature-permissions
nx g @nrwl/workspace:lib components-shared

nx build client
# works if the lib is marked as buildable or publishable
nx build client-feature-main

nx test client
nx test admin
nx test client-feature-main
nx e2e client-e2e
```

Now imagine, `admin` depends on `admin-feature-permissions`. If we make a change to `admin-feature-permissions`, we not only need to make sure that `admin-feature-permissions` still functions as intended. We also need to make sure nothing that depends on `admin-feature-permissions` such as `admin` is broken unintentionally.

Typically, you would do it like this:

```bash
nx test admin-feature-permissions
nx build admin
nx test admin
nx e2e admin-e2e
```

In many organizations, you would have dozens or hundreds of apps and libs. To be productive in a monorepo, you need to be able to check that your change is safe, and rebuilding and retesting everything on every change won't scale, tracing the dependencies manually (as shown above) won't scale either.

Because Nx has built-in computation caching, you could retest and rebuild everything on every commit:

```bash
nx run-many --target=test --all
nx run-many --target=lint --all
nx run-many --target=e2e --all
nx run-many --target=build --all
```

If you use [Nx Cloud](https://nx.app), this can be a viable option.

## Code Changes Analysis

In addition to computation caching, Nx supports code change analysis. Nx uses code analysis to construct a dependency graph of all projects in the workspace. It then uses the dependency graph to determine what needs to be rebuilt and retested based on what you changed in a git branch.

## Viewing Dep Graph

Run `nx dep-graph` to see the dependency graph.

![dependency-graph](/shared/dependency-graph.png)

## Affected

Affected projects are projects that are impacted by a set of changes. In order to find out which projects could be impacted by a particular change, Nx first determines which projects own the changed files. These projects are definitely impacted because they had changes made directly to them. Projects that consume projects which are directly changed may also be impacted by these changes. As a result, those projects must be tested as well to verify that all changes in behavior are identified.

To calculate the project affected by your change, Nx needs to know what file you changed. The most direct way to do it is by passing `--files`:

```bash
nx affected:dep-graph --files=libs/admin-feature-permissions/src/index.ts
```

![dependency-graph-affected](/shared/affected.png)

In practice, it's easier to use git to determine what files have changed.

```bash
nx affected:dep-graph --base=master --head=HEAD
```

The `--base` defaults to `master` and `--head` defaults to `HEAD`, so when running it locally you can usually omit it:

```bash
nx affected:dep-graph
```

Nx finds the most common ancestor of the base and head SHAs and uses it to determine what has changed between it and head.

## Building/Testing/Printing Affected Projects

```bash
nx affected:apps # prints affected apps
nx affected:libs # prints affected libs
nx affected:build # builds affected apps and libs
nx affected:lint # lints affected apps and libs
nx affected:test # tests affected apps and libs
nx affected:e2e # e2e tests affected apps
```

All of these are just shortcuts for the following:

```bash
nx affected --target=ANYTARGET # run ANYTARGET for all affected apps and libs
```

## CI

The SHAs you pass must be defined in the git repository. The `master` and `HEAD` SHAs are what you normally use while developing. Most likely you will want to provision other SHAs in your CI environment.

```bash
nx affected:build --base=origin/master --head=$PR_BRANCH_NAME # where PR_BRANCH_NAME is defined by your CI system
nx affected:build --base=origin/master~1 --head=origin/master # rerun what is affected by the last commit in master
```

## When Nx can't Understand Your Repository

Nx uses its advanced code analysis to construct a dependency graph of all applications and libraries. Some dependencies, however, cannot be determined statically. But you can define them yourself in `nx.json`.

```json
{
  "npmScope": "myorg",
  "implicitDependencies": {
    "package.json": "*",
    "tsconfig.base.json": "*",
    "nx.json": "*"
  },
  "projects": {
    "client": {
      "tags": [],
      "implicitDependencies": []
    },
    "client-e2e": {
      "tags": [],
      "implicitDependencies": ["client"]
    },
    "admin": {
      "tags": [],
      "implicitDependencies": []
    },
    "admin-e2e": {
      "tags": [],
      "implicitDependencies": ["admin"]
    },
    "client-feature-main": {
      "tags": [],
      "implicitDependencies": []
    },
    "admin-feature-permissions": {
      "tags": [],
      "implicitDependencies": []
    },
    "components-shared": {
      "tags": [],
      "implicitDependencies": []
    }
  }
}
```

The `implicitDependencies` map is used to define what projects are affected by global files. In this example, any change to `package.json` affects all the projects in the workspace, so all of them have to be rebuilt and retested. You can replace `*` with an explicit list of projects.

```json
{
  "implicitDependencies": {
    "package.json": ["admin", "client"],
    "tsconfig.base.json": "*",
    "nx.json": "*"
  }
}
```

The `package.json` can also be configured more granularly to look at properties inside the `package.json`, such as `dependencies` or `devDependencies` for affected projects.

```json
{
  "implicitDependencies": {
    "package.json": {
      "dependencies": "*",
      "devDependencies": "*"
    },
    "tsconfig.base.json": "*",
    "nx.json": "*"
  }
}
```

This would not invalidate the cache for changes to areas such as `scripts`, or other properties defined in the `package.json`.

You can also specify dependencies between projects. For instance, if `admin-e2e` tests both the `admin` and `client` applications, you can express this as follows:

```json
{
  "admin-e2e": {
    "tags": [],
    "implicitDependencies": ["client", "admin"]
  }
}
```

### Ignoring Additional Files from Affected Commands

Nx provides two methods to exclude additional glob patterns (files and folders) from `affected:*` commands.

- Glob patterns defined in your `.gitignore` file are ignored.
- Glob patterns defined in an optional `.nxignore` file are ignored.

## Caching and Affected

Affected and caching are used to solve the same problem: minimize the computation. But they do it differently, and the combination provides better results than one or the other.

The affected command looks at the before and after states of the workspaces and figures out what can be broken by a change. Because it knows the two states, it can deduce the nature of the change. For instance, this repository uses React and Angular. If a PR updates the version of React in the root package.json, Nx knows that only half of the projects in the workspace can be affected. It knows what was changed--the version of React was bumped up.

Caching simply looks at the current state of the workspace and the environment (such as the version of Node) and checks if somebody already ran the command against this state. Caching knows that something changed, but because there is no before and after states, it doesn't know the nature of the change. In other words, caching is a lot more conservative.

If you only use affected, the list of projects that are be retested is small, but if you test the PR twice, all the tests are run twice.

If you only use caching, the list of projects that are be retested is larger, but if you test the PR twice, the tests are only run the first time.

Using both allows you to get the best of both worlds. The list of affected projects is as small as it can be, and you never run anything twice.
