# Node Tutorial - Part 3: Task-Running

Now that you've created your projects in your Nx workspace, it's time to address how to run tasks in your workspace.

Common tasks for projects include:

- Building a distributable
- Serving an application locally for development purposes
- Running your unit tests
- Linting your code

When you ran your Nx generators in the first step of this tutorial, you actually already set up these more common tasks for each project.

## Defining Targets

Here's the `project.json` file for your `products-data-client` project:

```json {% fileName="libs/products-data-client/project.json" %}
{
  "name": "products-data-client",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/products-data-client/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nrwl/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/products-data-client",
        "main": "libs/products-data-client/src/index.ts",
        "tsConfig": "libs/products-data-client/tsconfig.lib.json",
        "assets": ["libs/products-data-client/*.md"]
      }
    },
    "lint": {
      "executor": "@nrwl/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/products-data-client/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nrwl/jest:jest",
      "outputs": ["coverage/libs/products-data-client"],
      "options": {
        "jestConfig": "libs/products-data-client/jest.config.ts",
        "passWithNoTests": true
      }
    }
  },
  "tags": []
}
```

You can see that three targets are defined here: `build`, `lint` and `test`.

The properties inside each of these these targets is defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save for it's caching mechanisms you'll learn about in [4 - Workspace Optimizations](/node-tutorial/4-workspace-optimization)).
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows for options as a way to parameterize it's functionality.

These targets are sufficient for your `products-data-client` project, but if more targets were required in the future, you could create more targets by defining them here.

## Running Tasks in Nx

Running a target in Nx uses the following syntax:

![Syntax for Running Tasks in Nx](/shared/node-tutorial/run-target-syntax.png)

Run the `build` target for our `products-data-client` project now, by running the command `npx nx test products-data-client`:

```bash
% npx nx build products-data-client

> nx run products-data-client:build

Compiling TypeScript files for project "products-data-client"...
Done compiling TypeScript files for project "products-data-client".

 ———————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project products-data-client (780ms)
```

You can now find your built `products-data-client` distributable in your `dist/libs/products-data-client` directory, as specified in the `outputPath` property of the `build` target options in your `project.json` file.

Next, run a lint check on your `products-data-client` project by running the command: `npx nx lint products-data-client`:

```bash
% npx nx lint products-data-client

> nx run products-data-client:lint


Linting "products-data-client"...

All files pass linting.


 ———————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project products-data-client (777ms)
```

Next, add some tests to your data client in the `products-data-client.spec.ts` file:

```typescript {% fileName="libs/products-data-client/src/lib/products-data-client.spec.ts" %}
import {
  createProductsDataClient,
  exampleProducts,
} from './products-data-client';

describe('productsDataClient', () => {
  it('should get all example products', async () => {
    const productsDataClient = createProductsDataClient();
    const products = await productsDataClient.getProducts();
    expect(products).toEqual(Object.values(exampleProducts));
  });

  it('should get example product by id', async () => {
    const productsDataClient = createProductsDataClient();
    const product = await productsDataClient.getProductById('1');
    expect(product).toEqual(exampleProducts['1']);
  });
});
```

And then run your `test` target by running the command: `npx nx test products-data-client`:

```bash
% npx nx test products-data-client

> nx run products-data-client:test

 PASS   products-data-client  libs/products-data-client/src/lib/products-data-client.spec.ts
  productsDataClient
    ✓ should get all example products (1 ms)
    ✓ should get example product by id

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.843 s
Ran all test suites.

 ———————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target test for project products-data-client (2s)
```

## What's Next

- Continue to [4: Workspace Optimization](/node-tutorial/4-workspace-optimization)
