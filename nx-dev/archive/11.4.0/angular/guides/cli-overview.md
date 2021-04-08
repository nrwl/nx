# Nx CLI

The Nx CLI is a command-line interface tool that helps you setup, develop, build, and maintain applications. It provides commands for:

- Generating new applications, and libraries with recommended defaults.
- Running a development webserver that rebuilds your app on changes.
- Generating a dependency graph for your application.
- Building, and running unit and E2E test for apps, and libraries affected by your changes.
- Formatting your source code to modern standards.
- ...

## Nx CLI and Angular CLI

The Nx CLI supports different types of generators and executors. When running Angular Devkit schematics (e.g., generating an Angular component), the Nx CLI will use Angular Devkit under the hood. So the result will be exactly the same as if you used the Angular CLI. When running Angular Devkit builders, the Nx CLI once again will use the same Angular Devkit under the hood.

In other words, anything the Angular CLI can run, the Nx CLI can run as well because it uses the same Angular Devkit written by the Angular team under the hood. Except that using the Nx CLI is often a lot faster because of its powerful computation caching and code change analysis.

The `Nx CLI` also supports a lot more commands than the Angular CLI. It can run a target against many projects in parallel, run a target against a project and its dependencies, visualize the dependency graph etc..

Nx will create the `decorate-angular-cli.js` file in a new Nx workspace. This file essentially "wraps" the Angular CLI to give you computation caching and other powerful feature, so running `nx build myapp` and `ng build myapp` will produce the same result.

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

[`nx list`](/{{framework}}/cli/list) will print the list of installed plugins and the list of plugins you can install. You can also pass a plugin name to it (e.g., `nx list @nrwl/angular`) to learn more about what the capabilities of that plugin.

## Generating Code

The Nx CLI has an advanced code generator. With it, you can generate new applications, libraries, components, state management utilities. You can change existing applications. And, because the Nx CLI comes with an implementation of a virtual file system, you can preview the changes without affecting anything on disk.

The code generation recipes are called generators. Generators provide the underlying APIs for scaffolding, and utilities to automate changes to your filesystem. The example below is the command to generate a new application.

```sh
nx generate @nrwl/angular:application myapp
```

The `@nrwl/angular` package contains a collection of generators, with `application` being the one used in this example. The Nx CLI applies the generator to your workspace, verifying that the provided options are valid, and the destination files don't already exist. Once the validations are passed, the new files are generated, or existing files are updated. You can also customize the output of the generated application, by passing options to the generator.

```sh
nx generate @nrwl/angular:application myapp --style=scss
```

You can preview the changes a generator makes by using the `--dry-run` option. It will output the potential files created, and/or updated during the execution of the generator.

**Generate command:**

`nx generate` runs generators to create or modify code given some inputs from the developer.

- [nx generate](/{{framework}}/cli/generate)  
  Syntax: `nx generate [plugin]:[generator-name] [options]`  
  Example: `nx generate @nrwl/angular:component mycmp --project=myapp`

## Running Tasks

The Nx CLI uses builders to perform tasks, such as building and bundling your application, running unit tests, or running E2E tests against a specific target, whether that be an application or workspace.

A builder is a function that uses the Architect API to perform a complex process such as "build", "test", or "lint".

You can configure the builders in `angular.json`.

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
nx run todos:serve:production # production configuration
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

## Loading Environment Variables

By default, Nx will load any environment variables you place in the following files:

1. `workspaceRoot/apps/my-app/.local.env`
2. `workspaceRoot/apps/my-app/.env`
3. `workspaceRoot/.local.env`
4. `workspaceRoot/.env`

Order is important. Nx will move through the above list, ignoring files it can't find, and loading environment variables into the current process for the ones it can find. If it finds a variable that has already been loaded into the process, it will ignore it. It does this for two reasons:

1. Developers can't accidentally overwrite important system level variables (like `NODE_ENV`)
2. Allows developers to create `.local.env` files for their local environment and override any project defaults set in `.env`

For example:

1. `workspaceRoot/apps/my-app/.local.env` contains `AUTH_URL=http://localhost/auth`
2. `workspaceRoot/apps/my-app/.env` contains `AUTH_URL=https://prod-url.com/auth`
3. Nx will first load the variables from `apps/my-app/.local.env` into the process. When it tries to load the variables from `apps/my-app/.env`, it will notice that `AUTH_URL` already exists, so it will ignore it.

We recommend nesting your **app** specific `env` files in `apps/your-app`, and creating workspace/root level `env` files for workspace-specific settings (like the [Nx Cloud token](/{{framework}}/core-concepts/computation-caching#nx-cloud-and-distributed-computation-memoization)).

### Pointing to custom env files

If you want to load variables from `env` files other than the ones listed above:

1. Use the [env-cmd](https://www.npmjs.com/package/env-cmd) package: `env-cmd -f .qa.env nx serve`
2. Use the `envFile` option of the [run-commands](/{{framework}}/workspace/run-commands-executor#envfile) builder and execute your command inside of the builder

## ng add Functionality

To run the equivalent of the Angular CLI's `ng add` command for a package named `my-package`, you need to run two commands:

```shell script
# npm
npm i my-package
nx g my-package:ng-add
```

```shell script
# yarn
yarn add my-package
nx g my-package:ng-add
```

Note: The plugins maintained by Nrwl have `init` as an alias for `ng-add`, so you can run `nx g @nrwl/angular:init` or `nx g @nrwl/angular:ng-add`.

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
