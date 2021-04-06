# Nx CLI

## Why use the Nx CLI?

The Nx CLI isn't just another terminal command that accomplishes a predefined task. Developers from Nrwl and the community have created plugins that provide a base level of functionality. In addition, custom generators and executors can be written - expanding the capabilities of the Nx CLI to fit what your organization needs.

The Nx CLI provides commands that fall into three categories:

- Modifying code using generators
- Acting on code using executors
- Understanding the whole codebase

## Modifying Code Using Generators

[Generators](/{{framework}}/generators/using-schematics) allow developers to automate a code modification task. Generators can be distributed as part of a plugin or developed locally in an Nx workspace. Generators can be composed to create complex workflows and then included in documentation to ensure consistency across the codebase.

## Acting on code using executors

[Executors](/{{framework}}/executors/using-builders) are commands that are run that don't affect the actual code. There are built in executors for `test`, `lint`, `serve` and `build` but custom executors can have any name. Nx automatically caches the output of executors so that re-running the same executor with the same code input will complete in seconds. The paid [Nx Cloud](https://nx.app) offering allows this cache to be shared across every developer in your organization.

## Understanding the whole codebase

Nx creates and maintains a dependency graph between projects based on import statements in your code and uses that information to run executors only on the [affected](/{{framework}}/cli/affected) projects in a codebase. A visual version of the [dependency graph](/{{framework}}/structure/dependency-graph) is also available to help developers understand the architecture of the codebase.

## Common Commands

**Invoke a generator:**

```bash
nx generate app my-node-app
```

[This command](/{{framework}}/cli/generate) creates a new Node app named `my-node-app`.

**Create a workspace generator:**

```bash
nx generate workspace-generator my-generator
nx workspace-generator my-generator
```

[The first command](/{{framework}}/cli/generate) scaffolds a new customizable workspace generator named `my-generator` and [the second command](/{{framework}}/cli/workspace-generator) invokes it.

**Update plugins:**

```bash
nx migrate latest
nx migrate --run-migrations=migrations.json
```

[The first command](/{{framework}}/cli/migrate) updates the installed Nx plugin versions and creates a list of generators to keep configuration files up to date. [The second command](/{{framework}}/cli/migrate) invokes those generators.

**Run an executor on one project:**

```bash
nx run my-app:build
nx build my-app
```

Both of [these commands](/{{framework}}/cli/run) build the `my-app` application. Custom executors need to use the more verbose `nx run project:target` syntax. See the [workspace.json documentation](/{{framework}}/core-concepts/configuration) for information on configuring executor options.

**Run an executor for all affected projects:**

```bash
nx affected --target=build
```

[This command](/{{framework}}/cli/affected) runs the build executor for all projects that are affected by the current code change.

**View the dependency graph:**

```bash
nx dep-graph
nx affected:dep-graph
```

[The first command](/{{framework}}/cli/dep-graph) launches a web browser with repository's dependency graph rendered visually. [The second command](/{{framework}}/cli/affected-dep-graph) renders the same graph with projects affected by the current code change highlighted.

**List installed plugins:**

```bash
nx list
```

[This command](/{{framework}}/cli/list) lists the currently installed Nx plugins and shows other plugins that are available.
