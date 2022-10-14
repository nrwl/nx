# Node Tutorial - Part 3: Task-Running

Common tasks include:

- Building an application
- Serving an application locally for development purposes
- Running your unit tests
- Linting your code

When you ran your generators in Part 1, you already set up these more common tasks for each project.

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

## Running Tasks

![Syntax for Running Tasks in Nx](/shared/node-tutorial/run-target-syntax.svg)

Run the `build` target for your `products-data-client` project:

```{% command="npx nx build products-data-client" path="~/my-products" %}

> nx run products-data-client:build

Compiling TypeScript files for project "products-data-client"...
Done compiling TypeScript files for project "products-data-client".

 ———————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project products-data-client (780ms)
```

You can now find your built `products-data-client` distributable in your `dist/libs/products-data-client` directory, as specified in the `outputPath` property of the `build` target options in your `project.json` file.

Next, run a lint check on `products-data-client`:

```{% command="npx nx lint products-data-client" path="~/my-products" %}

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

And then run your `test` target:

```{% command="npx nx test products-data-client" path="~/my-products" %}

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
