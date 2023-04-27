# Migrating an Angular CLI workspace to an Integrated Nx Monorepo

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

Your workspace is now powered by Nx! You can verify that your application still runs as intended:

- To serve, run `nx serve <app name>`.
- To build, run `nx build <app name>`.
- To run unit tests, run `nx test <app name>`.
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add and use more applications and libraries. You can add the `--watch` flag to `nx graph` to see the changes in-browser as you add them.

## Older Versions of Angular

Support for workspaces with multiple applications and libraries was added in Nx v14.1.0. If you are migrating using an older version of Nx, your workspace can only contain one application and no libraries in order to use the automated migration, otherwise, you can still [migrate manually](/recipes/adopting-nx-angular/angular-manual).

## Modified Folder Structure

The automated migration supports Angular CLI workspaces with a standard structure, configurations and features. If your workspace has deviated from what the Angular CLI generates, you might not be able to use the automated migration and you will need to [manually migrate your workspace](/recipes/adopting-nx-angular/angular-manual).

Currently, the automated migration supports workspaces using the following executors (builders):

- `@angular-devkit/build-angular:browser`
- `@angular-devkit/build-angular:dev-server`
- `@angular-devkit/build-angular:extract-i18n`
- `@angular-devkit/build-angular:karma`
- `@angular-devkit/build-angular:ng-packagr`
- `@angular-devkit/build-angular:protractor`
- `@angular-devkit/build-angular:server`
- `@angular-eslint/builder:lint`
- `@cypress/schematic:cypress`
- `@nguniversal/builders:prerender`
- `@nguniversal/builders:ssr-dev-server`

Support for other executors may be added in the future.

## Learn More

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/packages/cypress)
- [Using Jest for unit tests](/packages/jest)
- [Computation Caching](/concepts/how-caching-works)
- [Rebuilding and Retesting What is Affected](/concepts/affected)
- [Integrate with Editors](/core-features/integrate-with-editors)
- [Advanced Angular Micro Frontends with Dynamic Module Federation](/recipes/module-federation/dynamic-module-federation-with-angular)
