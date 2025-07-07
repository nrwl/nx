---
title: Switch to Workspaces and Project References
description: Learn how to migrate from TypeScript path aliases to package manager workspaces for project linking, enabling TypeScript project references for better performance.
---

# Switch to Workspaces and Project References

If you want to take advantage of the [performance benefits](/concepts/typescript-project-linking#typescript-project-references-performance-benefits) of TypeScript project references, it is recommended to use package manager workspaces for local [project linking](/concepts/typescript-project-linking). If you are currently using TypeScript path aliases for project linking, follow the steps in this guide to switch to workspaces project linking and enable TypeScript project references.

## Enable Package Manager Workspaces

Follow the specific instructions for your package manager to enable workspaces project linking.

{% tabs %}
{% tab label="npm" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/*", "libs/*"]
}
```

Defining the `workspaces` property in the root `package.json` file lets npm know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `npm install` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

If you reference a local library project with its own `build` task, you should include the library in the `devDependencies` of the application's `package.json` with `*` specified as the library's version. `*` tells npm to use whatever version of the project is available.

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
  "workspaces": ["apps/*", "libs/*"]
}
```

Defining the `workspaces` property in the root `package.json` file lets yarn know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `yarn` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

If you reference a local library project with its own `build` task, you should include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. [`workspace:*` tells yarn that the project is in the same repository](https://yarnpkg.com/features/workspaces) and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

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
  "workspaces": ["apps/*", "libs/*"]
}
```

Defining the `workspaces` property in the root `package.json` file lets bun know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `bun install` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

If you reference a local library project with its own `build` task, you should include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. [`workspace:*` tells bun that the project is in the same repository](https://bun.sh/docs/install/workspaces) and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

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
  - 'libs/*'
```

Defining the `packages` property in the root `pnpm-workspaces.yaml` file lets pnpm know to look for project `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `pnpm install` is run in the root folder.

If you reference a local library project from an application, you need to include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. [`workspace:*` tells pnpm that the project is in the same repository](https://pnpm.io/workspaces#workspace-protocol-workspace) and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

```json {% fileName="/apps/my-app/package.json" %}
{
  "devDependencies": {
    "@my-org/some-project": "workspace:*"
  }
}
```

{% /tab %}
{% /tabs %}

## Update Root TypeScript Configuration

The root `tsconfig.base.json` should contain a `compilerOptions` property and no other properties. `compilerOptions.composite` and `compilerOptions.declaration` should be set to `true`. `compilerOptions.paths` and `compilerOptions.rootDir` should not be set.

Note: Before you delete the `paths` property, copy the project paths for use as `references` in the `tsconfig.json` file.

{% tabs %}
{% tab label="Before" %}

```jsonc {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    "allowJs": false,
    "allowSyntheticDefaultImports": true,
    // ...
    "paths": {
      "@myorg/utils": ["libs/utils/src/index.ts"],
      "@myorg/ui": ["libs/ui/src/index.ts"]
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```jsonc {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    // Required compiler options
    "composite": true,
    "declaration": true, // defaults to true when composite is true
    // Delete the paths property
    // Other options...
    "allowJs": false,
    "allowSyntheticDefaultImports": true
  }
}
```

{% /tab %}
{% /tabs %}

The root `tsconfig.json` file should extend `tsconfig.base.json` and not include any files. It needs to have `references` for every project in the repository so that editor tooling works correctly.

{% tabs %}
{% tab label="Before" %}

```jsonc {% fileName="tsconfig.json" %}
{
  "extends": "./tsconfig.base.json",
  "files": [] // intentionally empty
}
```

{% /tab %}

{% tab label="After" %}

```jsonc {% fileName="tsconfig.json" %}
{
  "extends": "./tsconfig.base.json",
  "files": [], // intentionally empty
  "references": [
    // All projects in the repository
    {
      "path": "./libs/utils"
    },
    {
      "path": "./libs/ui"
    }
    // Future generated projects will automatically be added here by the generator
  ]
}
```

{% /tab %}
{% /tabs %}

## Register Nx Typescript Plugin

Make sure that the `@nx/js` plugin is installed in your repository and `@nx/js/typescript` is registered as a plugin in the `nx.json` file.

```jsonc {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/js/typescript",
      "options": {
        "typecheck": {
          "targetName": "typecheck"
        },
        "build": {
          "targetName": "build",
          "configName": "tsconfig.lib.json",
          "buildDepsName": "build-deps",
          "watchDepsName": "watch-deps"
        }
      }
    }
  ]
}
```

This plugin will register a [sync generator](/concepts/sync-generators) to automatically maintain the project references across the repository.

## Create Individual Project package.json files

When using package manager project linking, every project needs to have a `package.json` file. You can leave all the task configuration in the existing `project.json` file. For application projects, you only need to specify the `name` property. For library projects, you should add an `exports` property that accounts for any TypeScript path aliases that referenced the project. A typical configuration is shown below:

{% tabs %}
{% tab label="Non-buildable library" %}

```json {% fileName="libs/ui/package.json" %}
{
  "name": "@myorg/ui",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

{% /tab %}
{% tab label="Buildable Library" %}

```json {% fileName="libs/ui/package.json" %}
{
  "name": "@myorg/ui",
  "exports": {
    ".": {
      "types": "./src/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

{% /tab %}
{% tab label="Application" %}

```json {% fileName="apps/my-app/package.json" %}
{
  "name": "@myorg/my-app"
}
```

{% /tab %}
{% /tabs %}

{% callout type="warning" title="Package Names with Multiple Slashes" %}
The `package.json` name can only have one `/` character in it. This is more restrictive than the TypeScript path aliases. So if you have a project that you have been referencing with `@myorg/shared/ui`, you'll need to make the `package.json` name be something like `@myorg/shared-ui` and update all the import statements in your codebase to reference the new name.
{% /callout %}

## Update Individual Project TypeScript Configuration

{% callout type="note" title="Applications and Libraries" %}
The TypeScript configuration requirements described in this section apply to both application and library projects. While the examples below show library projects, the same principles apply to applications, except applications typically use `tsconfig.app.json` instead of `tsconfig.lib.json`.
{% /callout %}

Each project's `tsconfig.json` file should extend the `tsconfig.base.json` file and list `references` to the project's dependencies. Remove any `compilerOptions` listed and combine them with the options listed in the `tsconfig.lib.json` (for libraries) or `tsconfig.app.json` (for applications) and `tsconfig.spec.json` files.

The `tsconfig.json` file's purpose is to provide your IDE with `references` to the `tsconfig.*.json` files that define the compilation settings for all the files in the project. In this case, `tsconfig.spec.json` handles the compilation of the test files and `tsconfig.lib.json` or `tsconfig.app.json` handles the compilation of the production code.

```jsonc {% fileName="libs/ui/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "files": [], // intentionally empty
  "references": [
    // All project dependencies
    // UPDATED BY NX SYNC
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

Each project's `tsconfig.lib.json` (for libraries) or `tsconfig.app.json` (for applications) file extends the root `tsconfig.base.json` file and adds `references` to the `tsconfig.lib.json` files of project dependencies. This file should not extend the project's `tsconfig.json` file because the `tsconfig.json` file includes a reference to the `tsconfig.spec.json` file. Keeping the `tsconfig.spec.json` file unreferenced from the `tsconfig.lib.json` or `tsconfig.app.json` file makes the `typecheck` and `build` tasks faster because the test files do not need to be analyzed. Note that the `outDir` location needs to be unique across all `tsconfig.*.json` files so that one task's cached output does not interfere with another task's cached output.

{% callout type="note" title="Shared Compiler Options" %}
If there are a lot of shared `compilerOptions` between `tsconfig.lib.json` and `tsconfig.spec.json`, you could create a `tsconfig.project.json` that contains those shared settings. `tsconfig.project.json` would extend `tsconfig.base.json` while `tsconfig.lib.json` and `tsconfig.spec.json` would each extend `tsconfig.project.json`.
{% /callout %}

```jsonc {% fileName="libs/ui/tsconfig.lib.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    // outDir should be local to the project and not in the same folder as any other tsconfig.*.json
    "outDir": "./out-tsc/lib"
    // Any overrides
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    // exclude config and test files
  ],
  "references": [
    // tsconfig.lib.json files for project dependencies
    // UPDATED BY NX SYNC
  ]
}
```

{% callout type="note" title="Task Outputs Within the Project" %}
As part of this migration process, we are moving the task outputs for `typecheck` and `build` to be local to the project instead of being output to a root `dist` folder. This structure is more consistent with a workspaces style repository and helps to keep projects self-contained. It should be possible to continue to send task outputs to a root `dist` folder, but you'll need to make sure that the `outDir` and `exports` paths work correctly for your folder structure.
{% /callout %}

The project's `tsconfig.spec.json` does not need to reference project dependencies.

```jsonc {% fileName="libs/ui/tsconfig.spec.json" %}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    // outDir should be local to the project and not in the same folder as any other tsconfig.*.json
    "outDir": "./out-tsc/spec"
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

After creating these `tsconfig.*.json` files, run `nx sync` to have Nx automatically add the correct references for each project.

### Vite Configuration Updates

If you are using Vite to build a project, you need to update the `vite.config.ts` file for each project.

1. Remove the `nxViteTsPaths` plugin from the `plugins` array.
2. Set the `build.outDir` to `./dist` relative to the project's folder.
3. Make sure the `build.lib.name` matches the full name of the project, including the organization.

```ts {% fileName="libs/ui/vite.config.ts" %}
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig({
  // ...
  plugins: [
    // any needed plugins, but remove nxViteTsPaths
    react(),
    nxCopyAssetsPlugin(['*.md', 'package.json']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    // ...
    outDir: './dist',
    // ...
    lib: {
      name: '@myorg/ui',
      // ...
    },
  },
});
```

## Future Plans

We realize that this manual migration process is tedious. We are investigating automating parts of this process with generators.
