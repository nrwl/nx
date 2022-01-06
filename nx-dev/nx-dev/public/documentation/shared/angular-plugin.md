# Angular Plugin

![Angular logo](/shared/angular-logo.png)

The Nx Plugin for Angular contains executors, generators, and utilities for managing Angular applications, and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, Karma, Protractor, and Storybook.
- Helper services, and functions to use along with NgRx libraries.
- Scaffolding for upgrading AngularJS applications.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Adding the Angular plugin

Adding the Angular plugin to a workspace can be done with the following:

```bash
#yarn
yarn add -D @nrwl/angular
```

```bash
#npm
npm install -D @nrwl/angular
```

## Angular Projects in an Nx Workspace

Building Angular applications within an Nx workspace is similar to building within a vanilla Angular CLI workspace, with a few differences.

- ESLint is used as the default linter, configurable in the generators section of the workspace configuration.
- Jest is used as the default unit test runner, configurable in the generators section of the workspace configuration.
- Cypress is used as the default E2E test runner, configurable in the generators section of the workspace configuration.
- E2E tests are included in a separate project from the Angular application itself.
- The Nx CLI delegates common commands such as build, serve, test, lint, and e2e to the Angular CLI.

The file structure for an Angular application looks like:

```treeview
myorg/
├── apps/
│   ├── myapp/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.component.html
│   │   │   │   ├── app.component.scss
│   │   │   │   ├── app.component.spec.ts
│   │   │   │   ├── app.component.ts
│   │   │   │   └── app.module.ts
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   │   ├── environment.prod.ts
│   │   │   │   └── environment.ts
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test-setup.ts
│   │   ├── .browserslistrc
│   │   ├── .eslintrc.json
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.editor.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── myapp-e2e/
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── .eslintrc.json
│       ├── cypress.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── libs/
├── tools/
│   ├── generators/
│   └── tsconfig.tools.json
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

## See Also

- [Using DataPersistence](/guides/misc-data-persistence)
- [Using NgRx](/guides/misc-ngrx)
- [Upgrading an AngularJS application to Angular](/guides/misc-upgrade)

## Executors / Builders

- [delegate-build](/angular/delegate-build) - Delegates the build to a different target while supporting incremental builds.
- [ng-packagr-lite](/angular/ng-packagr-lite) - Builds a library with support for incremental builds.
- [package](/angular/package) - Builds and packages an Angular library to be distributed as an NPM package. It supports incremental builds.
- [webpack-browser](/angular/webpack-browser) - Builds a browser application with support for incremental builds and custom webpack configuration.

## Generators

- [application](/angular/application) - Creates an Angular application.
- [convert-tslint-to-eslint](/angular/convert-tslint-to-eslint) - Converts a project from TSLint to ESLint.
- [downgrade-module](/angular/downgrade-module) - Sets up a Downgrade Module.
- [karma](/angular/karma) - Adds Karma configuration to a workspace.
- [karma-project](/angular/karma-project) - Adds Karma configuration to a project.
- [library](/angular/library) - Creates an Angular library.
- [move](/angular/move) - Moves an Angular application or library to another folder within the workspace and updates the project configuration.
- [ngrx](/angular/ngrx) - Adds NgRx support to an application or library.
- [setup-mfe](/angular/setup-mfe) - Generate a Module Federation configuration for a given Angular application.
- [stories](/angular/stories) - Creates stories/specs for all components declared in a project.
- [storybook-configuration](/angular/storybook-configuration) - Adds Storybook configuration to a project.
- [storybook-migrate-defaults-5-to-6](/angular/storybook-migrate-defaults-5-to-6) - Generates default Storybook configuration files using Storybook version >=6.x specs, for projects that already have Storybook instances and configurations of versions <6.x.
- [storybook-migrate-stories-to-6-2](/angular/storybook-migrate-stories-to-6-2) - Migrates stories to match the new syntax in v6.2 where the component declaration should be in the default export.
- [upgrade-module](/angular/upgrade-module) - Sets up an Upgrade Module.
- [web-worker](/angular/web-worker) - Creates a Web Worker.

## Public API

- `DataPersistence` - Angular Service that provides convenience methods for common operations of persisting data.
- `fetch` - Handles data fetching, and correct ordering of fetching using NgRx Effects.
- `navigation` - Handles data fetching based on navigating to a certain component using NgRx Effects.
- `optimisticUpdate` - Handles optimistic updates (updating the client first) using NgRx Effects.
- `pessimisticUpdate` - Handles pessimistic updates (updating the server first) using NgRx Effects.
- `NxModule` - An NgModule used to register the Angular providers, including DataPersistence.
