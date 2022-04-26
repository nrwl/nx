# Project Configuration: package.json

There are two main types of configuration in every Nx workspace: [project configuration](#project-configuration)
and [workspace defaults and Nx CLI configuration](workspace-defaults-and-cli).

> This guide covers project configuration, to learn about workspace defaults and Nx CLI configuration you can check out [/configuration/workspace-defaults-and-cli](workspace-defaults-and-cli)

Projects can be configured in `package.json` (if you use npm scripts and not Nx executors) and `project.json` (if you
use Nx executors). Both `package.json` and `project.json` files are located in each project's folder. Nx merges the two
files to get each project's configuration. This guide covers the `package.json` case.

## Project Configuration

Every npm script defined in `package.json` is a target you can invoke via Nx. For instance, if your project has the
following `package.json`:

```jsonc
{
  "name": "mylib",
  "scripts": {
    "test": "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  }
}
```

you can invoke `nx build mylib` or `nx test mylib` without any extra configuration.

You can add Nx-specific configuration as follows:

```jsonc
{
  "name": "mylib",
  "scripts": {
    "test: "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  },
  "nx": {
    "targets": {
      "build": {
        "outputs": ["dist/libs/mylib"],
        "dependsOn": [
          {
            "target": "build",
            "projects": "dependencies"
          }
        ]
      },
      "test": {
        "outputs": [],
        "dependsOn": [
          {
            "target": "build",
            "projects": "self"
          }
        ]
      }
    }
  }
}
```

### outputs

`"outputs": ["dist/libs/mylib"]` tells Nx where the `build` target is going to create file artifacts. The provided value
is actually the default, so we can omit it in this case. `"outputs": []` tells Nx that the `test` target doesn't create
any artifacts on disk.

This configuration is usually not needed. Nx comes with reasonable defaults [(imported in `nx.json`)](workspace-defaults-and-cli) which implement the
configuration above.

### dependsOn

Targets can depend on other targets.

A common scenario is having to build dependencies of a project first before building the project. This is what
the `dependsOn` property of the `build` target configures. It tells Nx that before it can build `mylib` it needs to make
sure that `mylib`'s dependencies are built as well. This doesn't mean Nx is going to rerun those builds. If the right
artifacts are already in the right place, Nx will do nothing. If they aren't in the right place, but they are available
in the cache, Nx will retrieve them from the cache.

Another common scenario is for a target to depend on another target of the same project. For instance, `dependsOn` of
the `test` target tells Nx that before it can test `mylib` it needs to make sure that `mylib` is built, which will
result in `mylib`'s dependencies being built as well.

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the
configuration above.

### tags

You can annotate your projects with `tags` as follows:

```jsonc
{
  "name": "mylib",
  "nx": {
    "tags": ["scope:myteam"]
  }
}
```

You can [configure lint rules using these tags](/structure/monorepo-tags) to, for instance, ensure that libraries belonging to `myteam` are not depended on by libraries belong to `theirteam`.

### implicitDependencies

Nx uses powerful source-code analysis to figure out your workspace's project graph. Some dependencies cannot be deduced
statically, so you can set them manually like this:

```jsonc
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["anotherlib"]
  }
}
```

You can also remove a dependency as follows:

```jsonc
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
  }
}
```

### Ignoring a project

Nx will add every project with a `package.json` file in it to its project graph. If you want to ignore a particular
project, add the following to its `package.json`:

```jsonc
{
  "name": "mylib",
  "nx": {
    "ignore": true
  }
}
```

### workspace json

The `workspace.json` file in the root directory is optional. It's used if you want to list the projects in your workspace explicitly instead of Nx scanning the file tree for all `project.json` and `package.json` files that match the globs specified in the `workspaces` property of the root `package.json`.

```json
{
  "version": 2,
  "projects": {
    "myapp": "apps/myapp"
  }
}
```

- `"version": 2` tells Nx that we are using Nx's format for the `workspace.json` file.
- `projects` is a map of project names to their locations.
