# Configure TypeScript Project References in an Nx Workspace

In Nx 20, the `@nx/js` plugin provides the ability to incrementally build projects in a monorepo using [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html). Nx also provides a `ts` preset for `create-nx-workspace` that configures project references and uses `workspaces` to link projects instead of [TypeScript compilerOptions Paths](https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths).

The TypeScript team recommends using project references when working in a monorepo, but until now the configuration settings were difficult to maintain. Each project is required to list its own project dependencies in the `references` property of the `tsconfig.json` file so that TypeScript can incrementally compile projects in the correct order. In a large monorepo, maintaining those settings manually is cost prohibitive. To solve this problem, the `@nx/js` plugin registers a [sync generator](/concepts/sync-generators) to automatically update the references based on Nx's project graph before any TypeScript `build` task is executed.

## Create a New Nx Workspace Using Project References

We anticipate that this style of compiling projects will eventually become the default, but currently it will only be enabled for repositories configured in a specific way. Existing workspaces will continue to function as usual and there is no migration path yet. You can generate a new repository with these settings by using the `--preset=ts` flag of the `create-nx-workspace` command.

```shell
npx create-nx-workspace --preset=ts
```

{% callout type="note" title="Empty Workspace with Paths" %}
To generate an empty Nx workspace that links projects with the `compilerOptions.paths` property and does not use project references, use `create-nx-workspace --preset=apps`
{% /callout %}

This will generate an empty repository that is configured to use TypeScript project references. To see the new functionality in action, create some TypeScript projects and make sure to use the `tsc` bundler option.

```shell
nx g @nx/js:lib packages/cart --bundler=tsc
nx g @nx/js:lib packages/utils --bundler=tsc
```

These generators will detect that your repository is configured to use project references and update the configuration accordingly. If these generators were executed in an Nx repository that used `compilerOptions.paths`, they would update that setting instead.

To make `cart` depend on `utils`, update `packages/cart/package.json` like this:

```jsonc {% fileName="packages/cart/package.json" %}
{
  "dependencies": {
    "utils": "*"
  }
}
```

Now if you run `nx build cart` or directly run `nx sync`, the `packages/cart/tsconfig.json` file will have its references updated for you.

## Project Reference Configuration Files

Nx expects the following configuration settings to be in place in order to use TypeScript project references to build projects. Most of this configuration is set up and maintained for you automatically by Nx.

Identify projects in the `workspaces` property in the root `package.json` file.

```json {% fileName="package.json" %}
{
  "workspaces": ["packages/*"]
}
```

The root `tsconfig.base.json` should contain a `compilerOptions` property and no other properties. `compilerOptions.composite` and `compilerOptions.declaration` should be set to `true`. `compilerOptions.paths` should not be set.

```jsonc {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    // Required compiler options
    "composite": true,
    "declaration": true
    // Other options...
  }
}
```

The root `tsconfig.json` file should extend `tsconfig.base.json` and not include any files. It needs to have `references` for every project in the repository so that editor tooling works correctly.

```jsonc {% fileName="tsconfig.json" %}
{
  "extends": "./tsconfig.base.json",
  "files": [], // intentionally empty
  "references": [
    // UPDATED BY PROJECT GENERATORS
    // All projects in the repository
  ]
}
```

Each project's `tsconfig.json` file should extend the `tsconfig.base.json` file and list `references` to the project's dependencies.

```jsonc {% fileName="packages/cart/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "files": [], // intentionally empty
  "references": [
    // UPDATED BY NX SYNC
    // All project dependencies
    {
      "path": "../utils"
    },
    // This project's other tsconfig.*.json files
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

Each project's `tsconfig.lib.json` file extends the project's `tsconfig.json` file and adds `references` to the `tsconfig.lib.json` files of project dependencies.

```jsonc {% fileName="packages/cart/tsconfig.lib.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    // Any overrides
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    // exclude config and test files
  ],
  "references": [
    // UPDATED BY NX SYNC
    // tsconfig.lib.json files for project dependencies
    {
      "path": "../utils/tsconfig.lib.json"
    }
  ]
}
```

The project's `tsconfig.spec.json` does not need to reference project dependencies.

```jsonc {% fileName="packages/cart/tsconfig.spec.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    // Any overrides
  },
  "include": [
    // test files
  ],
  "references": [
    // tsconfig.lib.json for this project
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```
