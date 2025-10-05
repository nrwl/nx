---
title: 'TypeScript Project Linking'
description: 'Learn how to efficiently reference code between TypeScript projects in your monorepo using project linking instead of relative paths.'
---

# Typescript Project Linking

{% youtube src="https://youtu.be/D9D8KNffyBk" title="TypeScript Monorepos Done Right!" /%}

The naive way to reference code in a separate project is to use a relative path in the `import` statement.

```ts
import { someFunction } from '../../teamA/otherProject';

const result = someFunction();
```

The problem with this approach is that all your import statements become tied to your folder structure. Developers need to know the full path to any project from which they want to import code. Also, if `otherProject` ever moves locations, there will be superfluous code changes across the entire repository.

A more ergonomic solution is to reference your local projects as if they were external npm packages and then use a project linking mechanism to automatically resolve the project file path behind the scenes.

```ts
import { someFunction } from '@myorg/otherProject';

const result = someFunction();
```

There are two different methods that Nx supports for linking TypeScript projects: package manager workspaces and TypeScript path aliases. Project linking with TS path aliases was available with Nx before package managers offered a workspaces project linking approach. The Nx Team has since added full support for workspaces because (1) it has become more common across the TypeScript ecosystem and (2) packages will be resolved using native node module resolution instead of relying on TypeScript. Nx provides a cohesive experience for repositories using TypeScript path aliases without project references or repositories using package manager workspaces with TypeScript project references enabled.

## Project Linking with Workspaces

Create a new Nx workspace that links projects with package manager workspaces:

```shell
npx create-nx-workspace
```

{% callout type="note" title="Opt-out of Workspaces" %}
You can opt-out of workspaces by running `npx create-nx-workspace --no-workspaces`.
{% /callout %}

### Set Up Package Manager Workspaces

The configuration for package manager workspaces varies based on which package manager you're using.

{% tabs %}
{% tab label="npm" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Defining the `workspaces` property in the root `package.json` file lets npm know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `npm install` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

If you want to reference a local library project with its own `build` task, you should include the library in the `devDependencies` of the application's `package.json` with `*` specified as the library's version. `*` tells npm to use whatever version of the project is available.

```json {% fileName="/apps/my-app/package.json" %}
{
  "devDependencies": {
    "@my-org/some-project": "*"
  }
}
```

{% /tab %}
{% tab label="yarn" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Defining the `workspaces` property in the root `package.json` file lets yarn know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `yarn` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

If you want to reference a local library project with its own `build` task, you should include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. [`workspace:*` tells yarn that the project is in the same repository](https://yarnpkg.com/features/workspaces) and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

```json {% fileName="/apps/my-app/package.json" %}
{
  "devDependencies": {
    "@my-org/some-project": "*"
  }
}
```

{% /tab %}
{% tab label="bun" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Defining the `workspaces` property in the root `package.json` file lets bun know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `bun install` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

If you want to reference a local library project with its own `build` task, you should include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. [`workspace:*` tells bun that the project is in the same repository](https://bun.sh/docs/install/workspaces) and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

```json {% fileName="/apps/my-app/package.json" %}
{
  "devDependencies": {
    "@my-org/some-project": "workspace:*"
  }
}
```

{% /tab %}
{% tab label="pnpm" %}

```yaml {% fileName="pnpm-workspace.yaml" %}
packages:
  - 'apps/*'
  - 'packages/*'
```

Defining the `packages` property in the root `pnpm-workspaces.yaml` file lets pnpm know to look for project `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `pnpm install` is run in the root folder.

If you want to reference a local library project from an application, you need to include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. [`workspace:*` tells pnpm that the project is in the same repository](https://pnpm.io/workspaces#workspace-protocol-workspace) and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

```json {% fileName="/apps/my-app/package.json" %}
{
  "devDependencies": {
    "@my-org/some-project": "workspace:*"
  }
}
```

{% /tab %}
{% /tabs %}

### Set Up TypeScript Project References

With workspaces enabled, you can also configure TypeScript project references to speed up your build and typecheck tasks.

The root `tsconfig.base.json` should contain a `compilerOptions` property and no other properties. `compilerOptions.composite` and `compilerOptions.declaration` should be set to `true`. `compilerOptions.paths` should not be set.

```jsonc {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    // Required compiler options
    "composite": true,
    "declaration": true,
    "declarationMap": true
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

#### Individual Project TypeScript Configuration

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
  "extends": "../../tsconfig.base.json",
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
  "extends": "../../tsconfig.base.json",
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

### TypeScript Project References Performance Benefits

{% youtube src="https://youtu.be/O2xBQJMTs9E" title="Why TypeScript Project References Make Your CI Faster!" /%}

Using TypeScript project references improves both the speed and memory usage of build and typecheck tasks. The repository below contains benchmarks showing the difference between running typecheck with and without using TypeScript project references.

{% github-repository title="TypeScript Project References Benchmark" url="https://github.com/jaysoo/typecheck-timings" /%}

Here are the baseline typecheck task performance results.

```text
Typecheck without using project references: 186 seconds, max memory 6.14 GB
```

Using project references allows the TypeScript compiler to individually check the types for each project and store the results of that calculation in a `.tsbuildinfo` file for later use. Because of this, the TypeScript compiler does not need to load the entire codebase into memory at the same time, which you can see from the decreased memory usage on the first run with project references enabled.

```text
Typecheck with project references first run: 175 seconds, max memory 945 MB
```

Once the `.tsbuildinfo` files have been created, subsequent runs will be much faster.

```text
Typecheck with all `.tsbuildinfo` files created: 25 seconds, max memory 429 MB
```

Even if some projects have been updated and individual projects need to be type checked again, the TypeScript compiler can still use the cached `.tsbuildinfo` files for any projects that were not affected. This is very similar to the way Nx's caching and affected features work.

```text
Typecheck (1 pkg updated): 36.33 seconds, max memory 655.14 MB
Typecheck (5 pkg updated): 48.21 seconds, max memory 702.96 MB
Typecheck (25 pkg updated): 65.25 seconds, max memory 666.78 MB
Typecheck (100 pkg updated): 80.69 seconds, max memory 664.58 MB
Typecheck (1 nested leaf pkg updated): 26.66 seconds, max memory 407.54 MB
Typecheck (2 nested leaf pkg updated): 31.17 seconds, max memory 889.86 MB
Typecheck (1 nested root pkg updated): 26.67 seconds, max memory 393.78 MB
```

These performance benefits will be more noticeable for larger repositories, but even small code bases will see some benefits.

### Local TypeScript Path Aliases

If you define TS path aliases in an individual project's tsconfig files, you should not define them also in the root `tsconfig.base.json` file because TypeScript does not merge the paths. The paths defined in the root file would be completely overwritten by the ones defined in the project tsconfig. For instance, you could define paths like this in an application's tsconfig file.

```jsonc {% fileName="/apps/my-remix-app/tsconfig.app.json" %}
{
  "compilerOptions": {
    "paths": {
      "#app/*": ["./app/*"],
      "#tests/*": ["./tests/*"],
      "@/icon-name": [
        "./app/components/ui/icons/name.d.ts",
        "./types/icon-name.d.ts"
      ]
    }
  }
}
```

## Project Linking with TypeScript Path Aliases

{% callout type="warning" title="Path Aliases Overwrite Extended Configuration Files" %}
If you define path aliases in a project's specific `tsconfig.*.json` file, those path aliases will overwrite the path aliases defined in the root `tsconfig.base.json`. You can't use both project-level path aliases and root path aliases.
{% /callout %}

Linking projects with TypeScript path aliases is configured entirely in the tsconfig files. You can still use package manager workspaces to enable you to define separate third-party dependencies for individual projects, but the local project linking is done by TypeScript instead of the package manager.

The paths for each library are defined in the root `tsconfig.base.json` and each project's `tsconfig.json` should extend that file. Note that application projects do not need to have a path defined because no projects will import code from a top-level application.

```jsonc {% fileName="/tsconfig.base.json" %}
{
  "compilerOptions": {
    // common compiler option defaults for all projects
    // ...
    // These compiler options must be false or undefined
    "composite": false,
    "declaration": false,
    "paths": {
      // These paths are automatically added by Nx library generators
      "@myorg/shared-ui": ["packages/shared-ui/src/index.ts"]
      // ...
    }
  }
}
```
