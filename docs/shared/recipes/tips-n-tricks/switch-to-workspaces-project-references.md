# Switch to Workspaces and Project References

In order to take advantage of the [performance benefits](/concepts/typescript-project-linking#typescript-project-references-performance-benefits) of TypeScript project references, you need to use package manager workspaces for local [project linking](/concepts/typescript-project-linking). If you are currently using TypeScript path aliases for project linking, follow the steps in this guide to switch to workspaces project linking and enable TypeScript project references.

## Enable Package Manager Workspaces

Follow the specific instructions for your package manager to enable workspaces project linking.

{% tabs %}
{% tab label="npm" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/**", "libs/**"]
}
```

Defining the `workspaces` property in the root `package.json` file lets npm know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `npm install` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

{% /tab %}
{% tab label="yarn" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/**", "libs/**"]
}
```

Defining the `workspaces` property in the root `package.json` file lets yarn know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `yarn` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

{% /tab %}
{% tab label="bun" %}

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/**", "libs/**"]
}
```

Defining the `workspaces` property in the root `package.json` file lets bun know to look for other `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `bun install` is run in the root folder. Also, the projects themselves will be linked in the root `node_modules` folder to be accessed as if they were npm packages.

{% /tab %}
{% tab label="pnpm" %}

```yaml {% fileName="pnpm-workspace.yaml" %}
packages:
  # specify a package in a direct subdir of the root
  - 'my-app'
  # all packages in direct subdirs of packages/
  - 'packages/*'
  # all packages in subdirs of libs/
  - 'libs/**'
  # exclude packages that are inside test directories
  - '!**/test/**'
```

Defining the `packages` property in the root `pnpm-workspaces.yaml` file lets pnpm know to look for project `package.json` files in the specified folders. With this configuration in place, all the dependencies for the individual projects will be installed in the root `node_modules` folder when `pnpm install` is run in the root folder.

If you want to reference a local library project from an application, you need to include the library in the `devDependencies` of the application's `package.json` with `workspace:*` specified as the library's version. `workspace:*` tells pnpm that the project is in the same repository and not an npm package. You want to specify local projects as `devDependencies` instead of `dependencies` so that the library is not included twice in the production bundle of the application.

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

The root `tsconfig.base.json` should contain a `compilerOptions` property and no other properties. `compilerOptions.composite` and `compilerOptions.declaration` should be set to `true`. `compilerOptions.paths` should not be set.

Note: Before you delete the `paths` property, copy the project paths for use in the `tsconfig.json` file.

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
    "declaration": true,
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

## Create Individual Project package.json files

When using package manager project linking, every project needs to have a `package.json` file. The only required property of the `package.json` is the `name`, so you can leave all the task configuration in the existing `project.json` file.

```json {% fileName="libs/ui/package.json" %}
{
  "name": "@myorg/ui"
}
```

{% callout type="warning" title="Package Names with Multiple Slashes" %}
The `package.json` name can only have one `/` character in it. This is more restrictive than the TypeScript path aliases. So if you have a project that you have been referencing with `@myorg/shared/ui`, you'll need to make the `package.json` name be something like `@myorg/shared-ui` and update all the import statements in your codebase to reference the new name.
{% /callout %}

## Update Individual Project TypeScript Configuration

Each project's `tsconfig.json` file should extend the `tsconfig.base.json` file and list `references` to the project's dependencies.

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

Each project's `tsconfig.lib.json` file extends the project's `tsconfig.json` file and adds `references` to the `tsconfig.lib.json` files of project dependencies.

```jsonc {% fileName="libs/ui/tsconfig.lib.json" %}
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
    // tsconfig.lib.json files for project dependencies
    // UPDATED BY NX SYNC
  ]
}
```

The project's `tsconfig.spec.json` does not need to reference project dependencies.

```jsonc {% fileName="libs/ui/tsconfig.spec.json" %}
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

After creating these `tsconfig.*.json` files, run `nx sync` to have Nx automatically add the correct references for each project.

## Future Plans

We realize that this manual migration process is tedious. We are investigating automating parts of this process with generators.
