# Migrating an Angular CLI project to Nx

Within an Nx workspace, you gain many capabilities that help you build applications and libraries. If you are currently using an Angular CLI workspace, you can transform it into an Nx workspace.

## Migrating to a Standalone Angular App with Nx

You can migrate to a [Standalone Angular App](/concepts/integrated-vs-package-based#standalone-applications) with the command:

```shell
npx nx@latest init
```

This command will install the correct version of Nx based on your Angular version.

This will enable you to use the Nx CLI in your existing Angular CLI workspace while keeping your existing file structure in place. The following changes will be made in your repo to enable Nx:

- The `nx`, `@nx/workspace` and `prettier` packages will be installed.
- An `nx.json` file will be created in the root of your workspace.
- For an Angular 14+ repo, the `angular.json` file is split into separate `project.json` files for each project.

**Note:** The changes will be slightly different for Angular 13 and lower.

## Migrating to an Integrated Nx Monorepo

If you want to migrate your Angular CLI project to an [Integrated Nx Monorepo](/concepts/integrated-vs-package-based#integrated-repos), run the following command:

```shell
npx nx@latest init --integrated
```

The command applies the following changes to your workspace:

- Installs the `nx`, `@nx/angular` and `@nx/workspace` packages.
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

### Older Versions of Angular

Support for workspaces with multiple applications and libraries was added in Nx v14.1.0. If you are migrating using an older version of Nx, your workspace can only contain one application and no libraries in order to use the automated migration, otherwise, you can still [migrate manually](/recipes/angular/migration/angular-manual).

### Modified Folder Structure

The automated migration supports Angular CLI workspaces with a standard structure, configurations and features. If your workspace has deviated from what the Angular CLI generates, you might not be able to use the automated migration and you will need to [manually migrate your workspace](/recipes/angular/migration/angular-manual).

Currently, the automated migration supports workspaces using the following executors (builders):

- `@angular-devkit/build-angular:application`
- `@angular-devkit/build-angular:browser`
- `@angular-devkit/build-angular:browser-esbuild`
- `@angular-devkit/build-angular:dev-server`
- `@angular-devkit/build-angular:extract-i18n`
- `@angular-devkit/build-angular:karma`
- `@angular-devkit/build-angular:ng-packagr`
- `@angular-devkit/build-angular:prerender`
- `@angular-devkit/build-angular:protractor`
- `@angular-devkit/build-angular:server`
- `@angular-devkit/build-angular:ssr-dev-server`
- `@angular-eslint/builder:lint`
- `@cypress/schematic:cypress`
- `@nguniversal/builders:prerender`
- `@nguniversal/builders:ssr-dev-server`

Support for other executors may be added in the future.

## After migration

Your workspace is now powered by Nx! You can verify that your application still runs as intended:

- To serve, run `nx serve <app name>`.
- To build, run `nx build <app name>`.
- To run unit tests, run `nx test <app name>`.
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add and use more applications and libraries. You can add the `--watch` flag to `nx graph` to see the changes in-browser as you add them.

## Learn More

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/nx-api/cypress)
- [Using Jest for unit tests](/nx-api/jest)
- [Computation Caching](/concepts/how-caching-works)
- [Rebuilding and Retesting What is Affected](/ci/features/affected)
- [Integrate with Editors](/features/integrate-with-editors)
- [Advanced Angular Micro Frontends with Dynamic Module Federation](/recipes/angular/dynamic-module-federation-with-angular)

## From Nx Console

Nx Console no longer supports the Angular CLI. Angular CLI users will receive a notice, asking if they want to switch to Nx. When you click this button, we’ll run the `nx init` command to set up the Nx CLI, allowing for cached builds, and for you to share this cache with your teammates via Nx Cloud.

If you're not ready to make the change yet, you can come back to this later:

- If you're using Nx Console: open the Vs Code command palette and start typing "Convert Angular CLI to Nx Workspace".
- Regardless of using Nx Console (or your IDE): run `npx nx init` from the root of your project.

Once the script has run, commit the changes. Reverting this commit will effectively undo the changes made.

{% cards cols="1" mdCols="3" smCols="3" lgCols="3" %}

{% card title="Nx and the Angular CLI" description="Differences between Nx and the Angular CLI" type="documentation" url="/concepts/more-concepts/nx-and-angular" /%}

{% card title="Angular CLI manual migration" description="Add Nx by hand" type="documentation" url="/recipes/angular/migration/angular-manual" /%}

{% card title="Multiple Angular Repositories to one Nx Workspace" description="Combine multiple Angular CLI workspaces into one Nx workspace" type="documentation" url="/recipes/angular/migration/angular-multiple" /%}

{% /cards %}
