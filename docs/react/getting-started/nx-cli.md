# Nx CLI

## Why use the Nx CLI?

The Nx CLI isn't like most command lines that accomplishes a predefined task. Nx can be configured to work with
different tools and even different languages.

Nx allows you to break up your codebase into different **projects**. The Nx CLI provides commands to operate and manage
the different parts of the codebase. These commands fall into three categories:

- Acting on code (Build, Test, Serve)
- Modifying code
- Understanding the codebase

Run the `nx help` command to see a full list of commands in the Nx CLI.

## Acting on Code

Each project can be configured with **targets** that can be executed on the source code of the project.

The [`nx run` command](/{{framework}}/cli/run) executes a target on a single project. For convenience, you can also
run `nx [target] [project]` which is an alias to `nx run [project]:[target]`.

```bash
nx run my-react-app:build
nx build my-react-app
```

> Nx also automatically caches the output of running targets so re-running the same target on the same project source code will be instant.

However, `nx build` is only an abstraction over what it means to "build" projects rather than tied to a certain
implementation. Each target's has an **[executor](/{{framework}}/executors/using-builders)** which actually defines how
to execute target on a project. You can change the executor or write an entirely custom one to fit your needs. If you
don't specify an executor for the build target, `nx build my-react-app` will invoke the build npm script in the
project's folder.

Along with running a target on a single project, Nx provides some commands to run the same target across multiple
projects.

The [`nx run-many` command](/{{framework}}/cli/run-many) runs the same target name across a list of projects.

```bash
nx run-many --target=build --projects=app1,app2
nx run-many --target=test --all # Runs all projects that have a test target, use this sparingly.
```

The [`nx affected` command](/{{framework}}/cli/affected) isolates set projects that may have changed in behavior and
runs a target across them. This is more efficient than running all projects every time.

```bash
nx affected --target=build
```

## Modifying Code

The [`nx generate` command](/{{framework}}/cli/generate) generates and modifies code.

```bash
nx generate app my-react-app
nx generate @nrwl/react:lib shared-button
nx generate @nrwl/react:storybook-configuration shared-button # Configures storybook for a UI library
```

Again, like `nx run`, `nx generate` is only an abstraction over generating code. `nx generate` can generate anything you
want via **generators**. **[Generators](/{{framework}}/generators/using-schematics)** can be installed as part of a
plugin or developed locally within an Nx workspace to fit the needs of your organization.

A [Workspace Generator](/{{framework}}/generators/workspace-generators) is custom generator for your
workspace. `nx generate workspace-generator my-generator` generates a workspace generator which can be run with
the [`nx workspace-generator` command](/{{framework}}/cli/workspace-generator). This can be useful to allow your
organization to consistently generate projects according to your own standards.

```bash
nx workspace-generator my-generator
```

Upgrading a package is not always as simple as bumping the version in `package.json`.
The [`nx migrate` command](/{{framework}}/cli/migrate) facilitates not only managing package versions but also runs
migrations specified by package maintainers. See
the [full guide to updating Nx](/{{framework}}/core-concepts/updating-nx).

```bash
nx migrate latest # Updates the version of Nx in `package.json` and schedules migrations to be run
nx migrate --run-migrations # Runs the migrations scheduled by the previous command.
```

## Understanding the codebase

Nx creates and maintains a dependency graph between projects based on import statements in your code and uses that
information to run executors only on the [affected](/{{framework}}/cli/affected) projects in a codebase. A visual
version of the [dependency graph](/{{framework}}/structure/dependency-graph) is also available to help developers
understand the architecture of the codebase.

The [`nx dep-graph` command](/{{framework}}/cli/dep-graph) displays this dependency graph in a web browser for you to
explore.

```bash
nx dep-graph
nx dep-graph --watch # Updates the browser as code is changed
nx affected:dep-graph # Highlights projects which may have changed in behavior
```

The [`nx list` command](/{{framework}}/cli/list) lists the currently installed Nx plugins and other available plugins.
The `nx list` command can list the generators and executors that are available for a plugin.

**List installed plugins:**

```bash
nx list
nx list @nrwl/react # Lists capabilities in the @nrwl/react plugin
```

## Common Environment Variables

There are some environment variables that you can set to log additional information from Nx.

- Setting **NX_VERBOSE_LOGGING=true** will print debug information useful for troubleshooting.
- Setting **NX_PERF_LOGGING=true** will print debug information useful for profiling executors and Nx itself.
