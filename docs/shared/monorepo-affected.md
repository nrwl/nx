# Rebuilding and Retesting What is Affected

When using Nx you can build and test individual apps and libs.

```bash
nx g @nrwl/web:app client
nx g @nrwl/web:app admin
nx g @nrwl/workspace:lib client-feature-main
nx g @nrwl/workspace:lib admin-feature-permissions
nx g @nrwl/workspace:lib components-shared

nx build client
nx build client-feature-main # works if the lib is marked as publishable

nx test client
nx test admin
nx test client-feature-main
nx e2e client-e2e
```

Now imagine, `admin` depends on `admin-feature-permissions`. If we make a change to `admin-feature-permissions`, we need to make sure nothing in the workspace is broken unintentionally.

Typically, you would do it like this:

```bash
nx test admin-feature-permissions
nx build admin
nx test admin
nx e2e admin-e2e
```

In many organizations, you would have dozens or hundreds of apps and libs. To be productive in a monorepo, you need to be able to check that your change is safe, and rebuilding and retesting everything on every change won't scale, tracing the dependencies manually (as shown above) won't scale either.

Nx uses code analysis to construct a dependency graph of all projects in the workspace. It then uses the dependency graph to determine what needs to be rebuilt and retested.

## Viewing Dep Graph

Run `nx dep-graph` to see the dependency graph.

![dependency-graph](/shared/dependency-graph.png)

## Affected

To calculate the project affected by your change, Nx needs to know what file you changed. The most direct way to do it is by passing `--files`:

```bash
nx affected:dep-graph --files=libs/admin-feature-permissions/src/index.ts
```

![dependency-graph-affected](/shared/affected.png)

In practice it's easier to use git to determine what files have changed.

```bash
nx affected:dep-graph --base=master --head=HEAD
```

The `--base` defaults to `master` and `--head` defaults to `HEAD`, so when running it locally you can usually omit it:

```bash
nx affected:dep-graph
```

Nx will find the most common ancestor of the base and head SHAs and will use it to determine what has changed between it and head.

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

## Running Targets in Parallel

Running targets in parallel can significantly speed up your CI time. This is particularly useful in CI.

```bash
nx affected:build --parallel
nx affected:build --parallel --maxParallel=5
```

## Rerunning All Targets

You should never do it in CI, but it is sometimes useful to rerun all targets locally.

```bash
nx affected:build --all
```

## Running Failed

After you run any affected command, Nx remembers which targets fail. So if you want to rerun only the failed once, pass: `--only-failed`;

```bash
nx affected:build --only-failed
```

## Excluding Projects

Finally, you can exclude projects like this:

```bash
nx affected:test --all --exclude=admin # retests everything except admin
```

## When Nx can't Understand Your Repository

Nx uses its advanced code analysis to construct a dependency graph of all applications and libraries. Some dependencies, however, cannot be determined statically. But you can define them yourself in `nx.json`.

```json
{
  "npmScope": "myorg",
  "implicitDependencies": {
    "package.json": "*",
    "tsconfig.json": "*",
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

The `implicitDependencies` map is used to define what projects are affected by global files. In this example, any change to `package.json` will affect all the projects in the workspace, so all of them will have to be rebuilt and retested. You can replace `*` with an explicit list of projects.

```json
{
  "implicitDependencies": {
    "package.json": ["admin", "client"],
    "tsconfig.json": "*",
    "nx.json": "*"
  }
}
```

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
