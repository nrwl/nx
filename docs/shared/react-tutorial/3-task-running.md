# React Nx Tutorial - 3: Task-Running

Now that you've created your projects in your Nx workspace, it's time to address how to run tasks in your workspace.

Common tasks for projects include:

- Building a distributable
- Serving a local web server with the built project
- Running your unit tests
- Linting your code
- Running e2e tests

When you ran your Nx generators in the first step of this tutorial, you actually already set up these more common tasks for each project.

## Defining Targets

Here's the `project.json` file for your `products` project:

```json {% filename="libs/products/project.json" %}
{
  "name": "products",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/products/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nrwl/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/products",
        "main": "libs/products/src/index.ts",
        "tsConfig": "libs/products/tsconfig.lib.json",
        "assets": ["libs/products/*.md"]
      }
    },
    "lint": {
      "executor": "@nrwl/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/products/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nrwl/jest:jest",
      "outputs": ["coverage/libs/products"],
      "options": {
        "jestConfig": "libs/products/jest.config.ts",
        "passWithNoTests": true
      }
    }
  },
  "tags": []
}
```

You can see that three targets are defined here: `build`, `lint`, and `test`.

The properties inside each of these these targets is defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save for it's caching mechanisms you'll learn about in [4 - Workspace Optimizations](/react-tutorial/4-workspace-optimization)).
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows for options as a way to parameterize it's functionality.

{% callout type="note" title="Target Configurations" %}
In addition to allowing for option overrides at the command level, Nx also has a mechism called "configurations" for defining sets of option overrides. Common use-cases for this include a `development` and `production` configuration on your applications' `build` target.

You can read more in [this recipe for Executor configurations](/recipe/use-executor-configurations).
{% /callout %}

These targets are sufficient for your `products` project, but if more targets were required in the future, you could create more targets by defining them here.

{% callout type="note" title="Configuration-less Tasks"%}
In addition to configuring your tasks via Nx executors in a `project.json` file, Nx also supports configuration-less setup, where Nx can run tasks as defined by the `scripts` in your project's `package.json` file.

You can read more about configuring your project in [the Project Configuration reference page](/reference/project-configuration).
{% /callout %}

You can also check the `project.json` files of your other projects in the workspace (`admin`, `admin-e2e`, `store`, `store-e2e`, and `common-ui`) to see the targets already available for them.

## Syntax for Running Tasks in Nx

To run a target in Nx, use the following syntax:

![Syntax for Running Tasks in Nx](/shared/react-tutorial/run-target-syntax.png)

To see this in action, run the `test` target for our `products` project by running the command `npx nx test products`:

```bash
> npx nx test products

> nx run products:test

FAIL products libs/products/src/lib/products.spec.ts
● Test suite failed to run

    libs/products/src/lib/products.spec.ts:1:10 - error TS2724: '"./products"' has no exported member named 'products'. Did you mean 'Product'?

    1 import { products } from './products';
               ~~~~~~~~

Test Suites: 1 failed, 1 total
Tests: 0 total
Snapshots: 0 total
Time: 0.819 s
Ran all test suites.

———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

> NX Ran target test for project products (2s)

    ✖    1/1 failed
    ✔    0/1 succeeded [0 read from cache]

```

</details>

As we can see, our tests are currently failing as we haven't adjusted any of our tests since generating and making some changes to this project.

You can find the `jest.config.ts` file for this project here:

```ts {% filename="libs/products/jest.config.ts" %}
/* eslint-disable */
export default {
  displayName: 'products',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/products',
};
```

The generators you ran in part 1 of this tutorial created this file. Generally, you wouldn't need to touch this file as you add tests, you'd just need to add `<test name>.spec.ts` files anywhere in the project's source directory. You can however adjust the contents of this file (like you would outside the context of an Nx workspace) to match your workspace's specific requirements.

{% callout type="note" title="Discovering Executor Options" %}
To learn more about the options available for an executor you can add the `--help` option to your task command. For example:

```bash
> npx nx build products --help

>  NX   run products:build [options,...]


Executor:  @nrwl/js:tsc (v14.8.3)


  Builds using TypeScript.


Options:
    --main                    The name of the main entry-point file.                      [string]
    --rootDir                 Sets the rootDir for TypeScript compilation.                [string]
                              When not defined, it uses the root of project.
    --outputPath              The output path of the generated files.                     [string]
    --tsConfig                The path to the Typescript configuration file.              [string]
    --assets                  List of static assets.                         [array] [default: []]
    --watch                   Enable re-building when files change.                      [boolean]
    --clean                   Remove previous output before build.       [boolean] [default: true]
    --transformers            List of TypeScript Transformer Plugins.        [array] [default: []]

Find more information and examples at: https://nx.dev/packages/js/executors/tsc
```

{% /callout %}

{% callout type="note" title="Running Multiple Targets" %}
Nx also supports running multiple targets across projects with the `run-many` command.

See [the documentatation for `run-many`](/nx/run-many) for more details.
{% /callout %}

## What's Next

- Continue to [4: Workspace Optimization](/react-tutorial/4-workspace-optimization)
