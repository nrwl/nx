# Migrating an Angular CLI project to Nx

Within an Nx workspace, you gain many capabilities that help you build applications and libraries using a monorepo approach. If you are currently using an Angular CLI workspace, you can transform it into an Nx workspace.

## Migrating to a Standalone Angular App with Nx

You can migrate to a [Standalone Angular App](/angular-standalone-tutorial/1-code-generation) with the command:

```shell
npx nx init
```

This command will install the correct version of Nx based on your Angular version.

This will enable you to use the Nx CLI in your existing Angular CLI workspace while keeping your existing file structure in place. The following changes will be made in your repo to enable Nx:

- The `nx`, `@nrwl/workspace` and `prettier` packages will be installed.
- An `nx.json` file will be created in the root of your workspace.
- For an Angular 14+ repo, the `angular.json` file is split into separate `project.json` files for each project.

After the process completes, you can continue using the same `serve/build/lint/test` commands you are used to.

**Note:** The changes will be slightly different for Angular 13 and lower.

## Migrating to an Integrated Nx Monorepo

To take advantage of Nx's monorepo features provided by Nx and the Nx Angular plugin, you can also perform a migration from an Angular CLI to an Integrated Nx Monorepo with the command:

```shell
ng add @nrwl/angular@<version_number>
```

**Note**: To migrate to legacy versions of Nx prior to Nx 13.10, run the command:

```shell
ng add @nrwl/workspace@<version_number>
```

**Note**: Refer to the [Nx and Angular Version Compatibility Matrix](/packages/angular/documents/angular-nx-version-matrix) for matching Angular and Nx versions.

**Note**: Support for workspaces with multiple applications and libraries was added in Nx v14.1.0. If you are migrating using an older version of Nx, your workspace can only contain one application and no libraries in order to use the automated migration, otherwise, you can still [migrate manually](#transitioning-manually).

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

After the changes are applied, your workspace file structure should look similar to the one below:

```text
<workspace name>/
├── apps/
│   └─ <app name>/
│       ├── src/
│       │   ├── app/
│       │   ├── assets/
│       │   ├── favicon.ico
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── styles.css
│       ├── project.json
│       ├── tsconfig.app.json
│       └── tsconfig.spec.json
├── libs/
│   └── <lib name>/
│       ├── src/
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
├── karma.conf.js
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

Your workspace is now powered by Nx! You can verify out that your application still runs as intended:

- To serve, run `ng serve <app name>` (or `nx serve <app name>`).
- To build, run `ng build <app name>` (or `nx build <app name>`).
- To run unit tests, run `ng test <app name>` (or `nx test <app name>`).
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add, and use more applications and libraries. You can add the `--watch` flag to `nx graph` to see the changes in-browser as you add them.

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/packages/cypress)
- [Using Jest for unit tests](/packages/jest)
- [Computation Caching](/concepts/how-caching-works)
- [Rebuilding and Retesting What is Affected](/concepts/affected)

## Migrating multiple Angular CLI workspaces into an Nx Monorepo

Migrating multiple Angular CLI workspaces into a single Nx monorepo involves some more manual steps and decisions to take.

- can we first align all apps to the same Angular version (e.g. using Angular CLI migrations)
- convert each of the apps into an easy to copy "Nx shape" (with `project.json` etc) using some of the before mentioned migration scripts
- copy everything into a new Nx workspace

Very often however we might also need to do it incrementally, such as

- migrating all apps into a monorepo
- keep them at different Angular & external dependency versions until everything is migrated
- migrate them one by one incrementally and over time

The following video tutorial walks you through such a scenario.

{% youtube
src="https://www.youtube.com/embed/M5NwkRNrpK0"
title="Nx Tutorial: Migrate Multiple Angular CLI apps into a Single Nx Monorepo"
width="100%" /%}

## Migrating an Angular app manually

{% callout type="note" title="Older Angular Versions" %}
If you are using older versions of Angular (version 13 or lower), make sure to use the appropriate version of Nx that matches your version of Angular. See the [Nx and Angular Version Compatibility Matrix](/packages/angular/documents/angular-nx-version-matrix) to find the correct version. The generated files will also be slightly different.
{% /callout %}

If you are unable to automatically transform your Angular CLI workspace to an Nx workspace using the [ng add](#transforming-an-angular-cli-workspace-to-an-nx-workspace) method, there are some manual steps you can take to move your project(s) into an Nx workspace.

### Generating a new workspace

To start, run the command to generate an Nx workspace with an Angular application.

**Using `npx`**

```shell
npx create-nx-workspace myorg --preset=angular-standalone
```

**Using `npm init`**

```shell
npm init nx-workspace myorg --preset=angular-standalone
```

**Using `yarn create`**

```shell
yarn create nx-workspace myorg --preset=angular-standalone
```

When prompted for the `application name`, enter the _project name_ from your current `angular.json` file.

A new Nx workspace with your `org name` as the folder name, and your `application name` as the root-level application is generated.

```text
<workspace name>/
├── e2e/
│   ├── src/
│   ├── .eslintrc.json
│   ├── cypress.config.ts
│   ├── project.json
│   └── tsconfig.json
├── src/
│   ├── app/
│   ├── assets/
│   ├── favicon.ico
│   ├── index.html
│   ├── main.ts
│   ├── styles.css
│   └── test-setup.ts
├── .eslintrc.json
├── .eslintrc.base.json
├── .gitignore
├── .prettierignore
├── .prettierrc
├── jest.config.app.ts
├── jest.config.ts
├── jest.preset.js
├── nx.json
├── package.json
├── project.json
├── README.md
├── tsconfig.app.json
├── tsconfig.base.json
├── tsconfig.editor.json
├── tsconfig.json
└── tsconfig.spec.json
```

### Review Angular installed packages versions

Creating an Nx workspace with the latest version will install the Angular packages on their latest versions. If you're using a [lower version that's supported by the latest Nx](/packages/angular/documents/angular-nx-version-matrix), make sure to adjust the newly generated `package.json` file with your versions.

### Copying over application files

Your application code is self-contained within the `src` folder of your Angular CLI workspace.

- Copy the `src` folder from your Angular CLI project to the `apps/<app name>` folder, overwriting the existing `src` folder.
- Copy any project-specific configuration files, such as `browserslist`, or service worker configuration files into their relative path under `src` in the root of the repo.
- Transfer the `assets`, `scripts`, `styles`, and build-specific configuration, such as service worker configuration, from your Angular CLI `angular.json` to the root-level `project.json` file.

Verify your application runs correctly by running:

```shell
ng serve <app name>
```

### Updating your unit testing configuration

Nx uses Jest by default. If you have any custom Jest configuration, you need to update the workspace Jest configuration also.

Verify your tests run correctly by running:

```shell
ng test <app name>
```

If you are using `Karma` for unit testing:

- Copy the `karma.conf.js` file to the root folder.
- Copy the `test.ts` file to your `src` folder.
- Copy the `test` target in your `architect` configuration from your Angular CLI `angular.json` file into the `targets` configuration in the `project.json` file in your Nx workspace.
- Run `nx format` to change `architect` to `targets` and `builder` to `executor`.

> Jest will be used by default when generating new applications. If you want to continue using `Karma`, set the `unitTestRunner` to `karma` in the `generators` section of the `nx.json` file.

- Update `test-setup.ts` to `test.ts` in the `files` array of the `tsconfig.spec.json` file.

```json {% fileName="tsconfig.spec.json" %}
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

```shell
ng test <app name>
```

### Updating your E2E testing configuration

Nx uses Cypress by default. If you are already using Cypress, copy your E2E setup files into the `apps/<app name>-e2e` folder and verify your tests still run correctly by running:

```shell
ng e2e <app name>-e2e
```

If you are using `Protractor` for E2E testing:

- Delete the `e2e` folder that was generated to use Cypress.
- Copy the `e2e` folder from your Angular CLI workspace into the root folder.
- Create the project configuration file at `e2e/project.json`.
- Copy the project configuration for `e2e` from the Angular CLI workspace `angular.json` file to `e2e/project.json` and adjust the file paths to be relative to `e2e`.
- Run `nx format` to change `architect` to `targets` and `builder` to `executor`.

Create a `tsconfig.json` file under `e2e` folder:

```json {% fileName="e2e/tsconfig.json" %}
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../dist/out-tsc"
  }
}
```

Update the `tsconfig.app.json` to extend the root `tsconfig.json`:

```json {% fileName="tsconfig.app.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/out-tsc",
    "module": "commonjs",
    "target": "es5",
    "types": ["jasmine", "jasminewd2", "node"]
  }
}
```

Verify your E2E tests run correctly by running:

```shell
ng e2e e2e
```

> Cypress will be used by default when generating new applications. If you want to continue using `Protractor`, set the `e2eTestRunner` to `protractor` in the `generators` section of the `nx.json` file.

### Updating your linting configuration

For lint rules, migrate your existing rules into the root `.eslintrc.base.json` file.

Verify your lint checks run correctly by running:

```shell
npm run lint
```

OR

```shell
yarn lint
```

Learn more about the advantages of Nx in the following guides:

[Using Cypress for e2e tests](/packages/cypress) \
[Using Jest for unit tests](/packages/jest) \
[Rebuilding and Retesting What is Affected](/concepts/affected)

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

By running this command and accepting Nx Cloud, Nx distributed caching is now enabled.

Once the script has run, commit the changes. Reverting these changes will effectively undo the changes made.

If you're not ready to make the change yet, you can come back to this later:

- If you're using Nx Console: open the Vs Code command palette and start typing "make angular faster".
- Regardless of using Nx Console (or your IDE): run `npx make-angular-cli-faster` from the root of your project.
