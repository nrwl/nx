# Transitioning to Nx

Within an Nx workspace, you gain many capabilities that help you build applications and libraries using a monorepo approach. If you are currently using an Angular CLI workspace, you can transform it into an Nx workspace.

## Prerequisites

- The major version of your `Angular CLI` must align with the version of `Nx` you are upgrading to. For example, if you're using Angular CLI version 7, you must transition using the latest version 7 release of Nx.

## Using the Nx CLI while preserving the existing structure

To use the Nx CLI in an existing Angular CLI workspace while keeping your existing file structure in place, use the `ng add` command with the `--preserve-angular-cli-layout` option:

```bash
ng add @nrwl/angular --preserve-angular-cli-layout
```

**Note**: If you specify a version of Nx (e.g. `ng add @nrwl/angular@13.10.0`), please make sure to use the appropriate command as shown in the compatibility table below:

| Nx version          | Collection to use | Flag to use                     | Example                                                       |
| ------------------- | ----------------- | ------------------------------- | ------------------------------------------------------------- |
| >= 13.10.0          | `@nrwl/angular`   | `--preserve-angular-cli-layout` | `ng add @nrwl/angular@13.10.0 --preserve-angular-cli-layout`  |
| >= 13.8.4 < 13.10.0 | `@nrwl/workspace` | `--preserve-angular-cli-layout` | `ng add @nrwl/workspace@13.8.4 --preserve-angular-cli-layout` |
| < 13.8.4            | `@nrwl/workspace` | `--preserveAngularCLILayout`    | `ng add @nrwl/workspace@13.5.0 --preserveAngularCLILayout`    |

This installs the `@nrwl/angular` (or `@nrwl/workspace`) package into your workspace and runs a generator (or schematic) to make following changes:

- Installs the `nx` and `@nrwl/workspace` packages.
- Creates an `nx.json` file in the root of your workspace.
- Adds a `decorate-angular-cli.js` to the root of your workspace, and a `postinstall` script in your `package.json` to run the script when your dependencies are updated. The script forwards the `ng` commands to the Nx CLI (`nx`) to enable features such as [Computation Caching](/using-nx/caching).

After the process completes, you can continue using the same `serve/build/lint/test` commands you are used to.

## Transforming an Angular CLI workspace to an Nx workspace

To fully take advantage of all the features provided by Nx and the Nx Angular plugin, you can do a full migration from an Angular CLI to an Nx workspace.

> The automated migration supports Angular CLI workspaces with a standard structure, configurations and features. If your workspace has deviated from what the Angular CLI generates, you might not be able to use the automated migration and you will need to [manually migrate your workspace](#transitioning-manually).
>
> Currently, the automated migration supports workspaces using the following executors (builders):
>
> - `@angular-devkit/build-angular:browser`
> - `@angular-devkit/build-angular:dev-server`
> - `@angular-devkit/build-angular:extract-i18n`
> - `@angular-devkit/build-angular:karma`
> - `@angular-devkit/build-angular:ng-packagr`
> - `@angular-devkit/build-angular:protractor`
> - `@angular-devkit/build-angular:server`
> - `@angular-eslint/builder:lint`
> - `@cypress/schematic:cypress`
> - `@nguniversal/builders:prerender`
> - `@nguniversal/builders:ssr-dev-server`
>
> Support for other executors may be added in the future.

To transform an Angular CLI workspace to an Nx workspace, run the following command:

```bash
ng add @nrwl/angular
```

**Note**: If you specify a version of Nx (e.g. `ng add @nrwl/angular@13.10.0`), please make sure to use the appropriate command as shown in the compatibility table below:

| Nx version | Command to run           |
| ---------- | ------------------------ |
| >= 13.10.0 | `ng add @nrwl/angular`   |
| < 13.10.0  | `ng add @nrwl/workspace` |

> **Note**: Support for workspaces with multiple applications and libraries was added in Nx v14.1.0. If you are migrating using an older version of Nx, your workspace can only contain one application and no libraries in order to use the automated migration, otherwise, you can still [migrate manually](#transitioning-manually).

This installs the `@nrwl/angular` (or `@nrwl/workspace`) package into your workspace and runs a generator (or schematic) to transform your workspace. The generator applies the following changes to your workspace:

- Installs the `nx` and `@nrwl/workspace` packages.
- Creates an `nx.json` file in the root of your workspace.
- Creates configuration files for Prettier.
- Creates an `apps` folder for generating applications.
- Creates a `libs` folder for generating libraries.
- Creates a `tools` folder that includes files for custom workspace tooling, such as workspace-specific generators and scripts.
- Moves your applications into the `apps` folder, and updates the relevant file paths in your configuration files.
- Moves your e2e suites into the `apps/<app name>-e2e` folder, and updates the relevant file paths in your configuration files.
- Moves your libraries into the `libs` folder, and updates the relevant file paths in your configuration files.
- Updates your `package.json` scripts to use `nx` instead of `ng`.
- Splits your `angular.json` into `project.json` files for each project with updated paths.
- Updates the `angular.json` configuration to reflect the changes made.

After the changes are applied, your workspace file structure should look similar to the one below:

```treeview
<workspace name>/
├── apps/
│   ├── <app name>/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.css
│   │   │   └── test.ts
│   │   ├── .browserslistrc
│   │   ├── karma.conf.js
│   │   ├── project.json
│   │   ├── tsconfig.app.json
│   │   └── tsconfig.spec.json
│   └── <app name>-e2e/
│       ├── src/
│       ├── protractor.conf.js | cypress.json
│       ├── project.json
│       └── tsconfig.json
├── libs/
│   └── <lib name>/
│       ├── src/
│       ├── .browserslistrc
│       ├── karma.conf.js
│       ├── ng-package.json
│       ├── package.json
│       ├── project.json
│       ├── README.md
│       ├── tsconfig.lib.json
│       ├── tsconfig.lib.prod.json
│       └── tsconfig.spec.json
├── tools/
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc
├── angular.json
├── decorate-angular-cli.js
├── karma.conf.js
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

Your workspace is now powered by Nx! You can verify out that your application still runs as intended:

- To serve, run `ng serve` (or `nx serve`).
- To build, run `ng build` (or `nx build`).
- To run unit tests, run `ng test` (or `nx test`).
- To run e2e tests, run `ng e2e` (or `nx e2e`).
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add, and use more applications and libraries. You can add the `--watch` flag to `nx graph` to see this changes in-browser as you add them.

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/packages/cypress)
- [Using Jest for unit tests](/packages/jest)
- [Computation Caching](/using-nx/caching)
- [Rebuilding and Retesting What is Affected](/using-nx/affected)

## Transitioning Manually

If you are unable to automatically transform your Angular CLI workspace to an Nx workspace using the [ng add](#transforming-an-angular-cli-workspace-to-an-nx-workspace) method, there are some manual steps you can take to move your project(s) into an Nx workspace.

### Generating a new workspace

To start, run the command to generate an Nx workspace with an Angular application.

**Using `npx`**

```bash
npx create-nx-workspace myorg --preset=angular
```

**Using `npm init`**

```bash
npm init nx-workspace myorg --preset=angular
```

**Using `yarn create`**

```bash
yarn create nx-workspace myorg --preset=angular
```

When prompted for the `application name`, enter the _project name_ from your current `angular.json` file.

A new Nx workspace with your `org name` as the folder name, and your `application name` as the first application is generated.

```treeview
<workspace name>/
├── apps/
│   ├── <app name>/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.css
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.conf.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tslint.json
│   │   └── tsconfig.spec.json
│   └── <app name>-e2e/
│       ├── src/
│       ├── cypress.json
│       ├── tsconfig.e2e.json
│       ├── tslint.json
│       └── tsconfig.json
├── libs/
├── tools/
├── .editorconfig
├── .eslintrc.json
├── .gitignore
├── .prettierignore
├── .prettierrc
├── angular.json
├── decorate-angular-cli.js
├── jest.config.js
├── jest.preset.js
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

### Copying over application files

Your application code is self-contained within the `src` folder of your Angular CLI workspace.

- Copy the `src` folder from your Angular CLI project to the `apps/<app name>` folder, overwriting the existing `src` folder.
- Copy any project-specific configuration files, such as `browserslist`, or service worker configuration files into their relative path under the `apps/<app name>` folder.
- Transfer the `assets`, `scripts`, `styles`, and build-specific configuration, such as service worker configuration, from your Angular CLI `angular.json` to the `apps/<app name>/project.json` file.

Verify your application runs correctly by running:

```bash
ng serve <app name>
```

### Updating your unit testing configuration

Nx uses Jest by default. If you have any custom Jest configuration, you need to update the workspace Jest configuration also.

Verify your tests run correctly by running:

```bash
ng test <app name>
```

If you are using `Karma` for unit testing:

- Copy the `karma.conf.js` file to your `apps/<app name>` folder.
- Copy the `test.ts` file to your `apps/<app name>/src` folder.
- Copy the `test` target in your `architect` configuration from your Angular CLI `angular.json` file into the `targets` configuration in the `apps/<app name>/project.json` file in your Nx workspace.
- Update the `test` target file paths to be relative to `apps/<app name>`.

```json
// apps/<app name>/project.json
{
  "projectType": "application",
  "sourceRoot": "apps/<app name>/src",
  "prefix": "myapp",
  "targets": {
    "test": {
      "executor": "@angular-devkit/build-angular:karma",
      "options": {
        "main": "apps/<app name>/src/test.ts",
        "polyfills": "apps/<app name>/src/polyfills.ts",
        "tsConfig": "apps/<app name>/tsconfig.spec.json",
        "karmaConfig": "apps/<app name>/karma.conf.js",
        "assets": [
          "apps/<app name>/src/favicon.ico",
          "apps/<app name>/src/assets"
        ],
        "styles": ["apps/<app name>/src/styles.css"],
        "scripts": []
      }
    }
    ...
  }
}
```

> Jest will be used by default when generating new applications. If you want to continue using `Karma`, set the `unitTestRunner` to `karma` in the `generators` section of the `nx.json` file.

- Update `test-setup.ts` to `test.ts` in the `files` array of the `apps/<app name>/tsconfig.spec.json` file.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["jasmine", "node"]
  },
  "files": ["src/test.ts", "src/polyfills.ts"],
  "include": ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"]
}
```

Verify your tests run correctly by running:

```bash
ng test <app name>
```

### Updating your E2E testing configuration

Nx uses Cypress by default. If you are already using Cypress, copy your E2E setup files into the `apps/<app name>-e2e` folder and verify your tests still run correctly by running:

```bash
ng e2e <app name>-e2e
```

If you are using `Protractor` for E2E testing:

- Delete the `apps/<app name>-e2e` folder that was generated to use Cypress.
- Copy the `e2e` folder from your Angular CLI workspace into the `apps` folder.
- Rename the `e2e` folder to `<app name>-e2e`.
- Create the project configuration file at `apps/<app name>-e2e/project.json`.
- Copy the project configuration for `app name` from the Angular CLI workspace `angular.json` file to `apps/<app name>-e2e/project.json` and adjust the file paths to be relative to `apps/<app name>-e2e`.

```json
// apps/<app name>-e2e/project.json
{
  "projectType": "application",
  "targets": {
    "e2e": {
      "executor": "@angular-devkit/build-angular:protractor",
      "options": {
        "protractorConfig": "apps/<app name>-e2e/protractor.conf.js"
      },
      "configurations": {
        "production": {
          "devServerTarget": "<app name>:serve:production"
        },
        "development": {
          "devServerTarget": "<app name>:serve:development"
        }
      }
      "defaultConfiguration": "development"
    },
    "lint": {
      "executor": "@angular-devkit/build-angular:tslint",
      "options": {
        "tsConfig": "apps/<app name>-e2e/tsconfig.e2e.json",
        "exclude": ["**/node_modules/**", "!apps/<app name>-e2e/**/*"]
      }
    }
  },
  "implicitDependencies": ["<app name>"],
  "tags": []
}
```

Create a `tsconfig.e2e.json` file under `apps/<app name>-e2e` folder:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc"
  }
}
```

Update the `apps/<app name>/tsconfig.json` to extend the root `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/<app name>-e2e",
    "module": "commonjs",
    "target": "es5",
    "types": ["jasmine", "jasminewd2", "node"]
  }
}
```

Verify your E2E tests run correctly by running:

```bash
ng e2e <app name>-e2e
```

> Cypress will be used by default when generating new applications. If you want to continue using `Protractor`, set the `e2eTestRunner` to `protractor` in the `generators` section of the `nx.json` file.

### Updating your linting configuration

For lint rules, migrate your existing rules into the root `tslint.json` file.

Verify your lint checks run correctly by running:

```bash
npm run lint
```

OR

```bash
yarn lint
```

Learn more about the advantages of Nx in the following guides:

[Using Cypress for e2e tests](/packages/cypress) \
[Using Jest for unit tests](/packages/jest) \
[Rebuilding and Retesting What is Affected](/using-nx/affected)

## From Nx Console

{% youtube
src="https://www.youtube.com/embed/vRj9SNVYKrE"
title="Nx Console Updates 17.15.0"
width="100%" /%}

As of Nx Console version 17.15.0, Angular CLI users will receive a notice periodically when running commands via Nx Console, asking if they want to use Nx to make their Angular commands faster.

When you click this button, we’ll run the [make-angular-cli-faster script](https://github.com/nrwl/nx/tree/master/packages/make-angular-cli-faster) to decorate your Angular workspace with Nx, allowing for cached builds, and for you to share this cache with your teammates via Nx Cloud.

The script will make the following changes:

- Installs the `@nrwl/workspace` and `nx` packages.
  - If you opted into Nx Cloud, `@nrwl/nx-cloud` will be installed as well.
  - If your project's Angular version is greater than or equal to version 13, then the `@nrwl/angular` package will be installed as well.
- Creates an `nx.json` file in the root of your workspace.
- Adds a `decorate-angular-cli.js` to the root of your workspace, and a `postinstall` script in your `package.json` to run the script when your dependencies are updated. The script forwards the `ng` commands to the Nx CLI (`nx`) to enable features such as [Computation Caching](/using-nx/caching).

By running this command and accepting Nx Cloud, Nx distributed caching is now enabled.

Once the script has run, commit the changes. Reverting these changes will effectively undo the changes made.

If you're not ready to make the change yet, you can come back to this later:

- If you're using Nx Console: open the Vs Code command palette and start typing "make angular faster".
- Regardless of using Nx Console (or your IDE): run `npx make-angular-cli-faster` from the root of your project.
