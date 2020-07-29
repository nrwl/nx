# Nx CLI

The Nx CLI is a command-line interface tool that helps you setup, develop, build, and maintain applications. It provides commands for:

- Generating new applications, and libraries with recommended defaults.
- Running a development webserver that rebuilds your app on changes.
- Generating a dependency graph for your application.
- Building, and running unit and E2E test for apps, and libraries affected by your changes.
- Formatting your source code to modern standards.
- ...

## Installing the CLI

Install the Nx CLI globally on your system using your preferred package manager:

Using npm:

```bash
npm install -g nx
```

Using yarn:

```bash
yarn global add nx
```

After that, you will have an `nx` executable you can use to run commands in your workspace.

If you don't have the Nx CLI installed globally, you can invoke `nx` using `yarn nx` and `npm run nx`.

## Help and List

`nx help` will print a short description of every command. You can also pass `--help` to a command to see the available options (e.g., `nx affected --help`).

[`nx list`](/{{framework}}/cli/list) will print the list of installed plugins and the list of plugins you can install. You can also pass a plugin name to it (e.g., `nx list @nrwl/react`) to learn more about what the capabilities of that plugin.

## Generating Code

The Nx CLI has an advanced code generator. With it, you can generate new applications, libraries, components, state management utilities. You can change existing applications. And, because the Nx CLI comes with an implementation of a virtual file system, you can preview the changes without affecting anything on disk.

The code generation recipes are called schematics. Schematics provide the underlying APIs for scaffolding, and utilities to automate changes to your filesystem. The example below is the command to generate a new application.

```sh
nx generate @nrwl/react:application myapp
```

The `@nrwl/react` package contains a collection of schematics, with `application` being the one used in this example. The Nx CLI applies the schematic to your workspace, verifying that the provided options are valid, and the destination files don't already exist. Once the validations are passed, the new files are generated, or existing files are updated. You can also customize the output of the generated application, by passing options to the schematic.

```sh
nx generate @nrwl/react:application myapp --style=scss
```

You can preview the changes a schematic makes by using the `--dry-run` option. It will output the potential files created, and/or updated during the execution of the schematic.

**Generate command:**

`nx generate` runs schematics to create or modify code given some inputs from the developer.

- [nx generate](/{{framework}}/cli/generate)  
  Syntax: `nx generate [plugin]:[schematic-name] [options]`  
  Example: `nx generate @nrwl/react:component mycmp --project=myapp`

## Running Tasks

The Nx CLI uses builders to perform tasks, such as building and bundling your application, running unit tests, or running E2E tests against a specific target, whether that be an application or workspace.

A builder is a function that uses the Architect API to perform a complex process such as "build", "test", or "lint".

You can configure the builders in `workspace.json`.

```json
{
  "projects": {
    "todos": {
      "root": "apps/todos/",
      "sourceRoot": "apps/todos/src",
      "projectType": "application",
      "architect": {
        "serve": {
          "builder": "@nrwl/web:dev-server",
          "options": {
            "buildTarget": "todos:build",
            "proxyConfig": "apps/todos/proxy.conf.json"
          },
          "configurations": {
            "production": {
              "buildTarget": "todos:build:production"
            }
          }
        },
        "test": {
          "builder": "@nrwl/jest:jest",
          "options": {
            "jestConfig": "apps/todos/jest.config.js",
            "tsConfig": "apps/todos/tsconfig.spec.json",
            "setupFile": "apps/todos/src/test-setup.ts"
          }
        }
      }
    }
  }
}
```

In the example above, the `todos` application has two targets: `serve` and `test`. The `serve` target uses the `@nrwl/web:dev-server` builder, and the `test` target uses `@nrwl/jest:jest`. Every target uses a builder which actually runs this target. So targets are analogous to typed npm scripts, and builders are analogous to typed shell scripts.

You can run the target as follows:

```bash
nx run todos:serve
nx run todos:test
```

A target can have multiple configuration. In the example above the serve target has two configurations: default and production.

```bash
nx run todos:serve # default configuration
nx run todos:serve:production # producttion configuration
```

Because running target is such a common operation, you can also use the following syntax to do it:

```bash
nx serve todos
nx serve todos --configuration=production
nx serve todos --prod
```

You can name your targets any way you want, define as many of them as you want, and use any builders you want to implement them.

**These are some common targets:**

- [nx build](/{{framework}}/cli/build)  
  Syntax: `nx build [project]`  
  Long form: `nx run [project]:build`  
  Example: `nx build my-app`
- [nx lint](/{{framework}}/cli/lint)  
  Syntax: `nx lint [project]`  
  Long form: `nx run [project]:lint`  
  Example: `nx lint my-app`
- [nx serve](/{{framework}}/cli/serve)  
  Syntax: `nx serve [project]`  
  Long form: `nx run [project]:serve`  
  Example: `nx serve my-app`
- [nx e2e](/{{framework}}/cli/e2e)  
  Syntax: `nx e2e [project]`  
  Long form: `nx run [project]:e2e`  
  Example: `nx e2e my-app`
- [nx test](/{{framework}}/cli/test)  
  Syntax: `nx test [project]`  
  Long form: `nx run [project]:test`  
  Example: `nx test my-app`

## Running Tasks for Multiple Projects

Nx allows you to run tasks across multiple projects.

### Run-Many

Run the same target for all projects.

```sh
nx run-many --target=build --all
```

Run the same target for all projects in parallel.

```sh
nx run-many --target=build --all --parallel --maxParallel=8
```

Run the same target for selected projects.

```sh
nx run-many --target=build --projects=app1,app2
```

Run the same target for selected projects and their deps.

```sh
nx run-many --target=build --projects=app1,app2 --with-deps
```

Run the same target for the projects that failed last time.

```sh
nx run-many --target=build --all --only-failed
```

Any flags you pass to `run-many` that aren't Nx specific will be passed down to the builder.

```sh
nx run-many --target=build --all --prod
```

### Affected

Run the same target for all the projects by the current code change (e.g., current Git branch).

```sh
nx affected --target=build
```

Same but in parallel.

```sh
nx affected --target=build --parallel --maxParallel=8
```

By default, the current code change is defined as a diff between master and HEAD. You can change it as follows:

```sh
nx affected --target=build --parallel --maxParallel=8 --base=origin/development --head=$CI_BRANCH_NAME
```

Running `affected` commands is very common, so Nx comes with a few shortcuts.

```sh
nx affected:build
nx affected:test
nx affected:lint
nx affected:e2e
```

Any flags you pass to `run-many` that aren't Nx specific will be passed down to the builder.

```sh
nx affected --target=build --prod
```

## Other Commands

`nx print-affected` prints information about affected projects in the workspace.

- [nx print-affected](/{{framework}}/cli/print-affected)  
  Syntax: `nx print-affected`

`nx dep-graph` launches a visual graph of the dependencies between your projects.

- [nx dep-graph](/{{framework}}/cli/dep-graph)  
  Syntax: `nx dep-graph`

`nx affected:dep-graph` launches the dependency graph with all affected projects highlighted.

- [nx affected:dep-graph](/{{framework}}/cli/affected-dep-graph)  
  Syntax: `nx affected:dep-graph`

`nx list` lists all installed and available plugins.

- [nx list](/{{framework}}/cli/list)  
  Syntax: `nx list`

`nx report` prints basic information about the plugins used

- [nx report](/{{framework}}/cli/report)  
  Syntax: `nx report`

`nx format:write` formats your code

- [nx format:write](/{{framework}}/cli/format-write)  
  Syntax: `nx format:write`

`nx format:check` checks that your code is formatted

- [nx format:check](/{{framework}}/cli/format-check)  
  Syntax: `nx format:check`
