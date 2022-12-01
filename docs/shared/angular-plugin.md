The Nx Plugin for Angular contains executors, generators, and utilities for managing Angular applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Storybook, Jest, Cypress, Karma, and Protractor.
- Generators to help scaffold code quickly, including:
  - Micro Frontends
  - Libraries, both internal to your codebase and publishable to npm
  - Upgrading AngularJS applications
  - Single Component Application Modules (SCAMs)
- NgRx helpers.
- Utilities for automatic workspace refactoring.

{% callout type="note" title="Currently using the Angular CLI?" %}
You can easily and mostly **automatically migrate from an Angular CLI** project to Nx! Learn more [here](/recipes/adopting-nx/migration-angular).
{% /callout %}

## Setting up the Angular plugin

Adding the Angular plugin to an existing Nx workspace can be done with the following:

```shell
yarn add -D @nrwl/angular
```

```shell
npm install -D @nrwl/angular
```

## Using the Angular Plugin

### Generating an application

It's straightforward to generate an Angular application:

```shell
nx g @nrwl/angular:app appName
```

By default, the application will be generated with:

- ESLint as the linter.
- Jest as the unit test runner.
- Cypress as the E2E test runner.

We can then serve, build, test, lint, and run e2e tests on the application with the following commands:

```shell
nx serve appName
nx build appName
nx test appName
nx lint appName
nx e2e appName
```

### Generating a library

Generating an Angular library is very similar to generating an application:

```shell
nx g @nrwl/angular:lib libName
```

By default, the library will be generated with:

- ESLint as the linter.
- Jest as the unit test runner.

We can then test and lint the library with the following commands:

```shell
nx test libName
nx lint libName
```

Read more about:

- [Creating Libraries](/more-concepts/creating-libraries)
- [Library Types](/more-concepts/library-types)
- [Buildable and Publishable Libraries](/more-concepts/buildable-and-publishable-libraries)

## More Documentation

- [Angular Nx Tutorial](/angular-tutorial/1-code-generation)
- [Migrating from the Angular CLI](recipe/migration-angular)
- [Setup Module Federation with Angular and Nx](/recipes/module-federation/faster-builds)
- [Using NgRx](/recipes/other/misc-ngrx)
- [Using Data Persistence operators](/recipes/other/misc-data-persistence)
- [Upgrading an AngularJS application to Angular](/recipes/adopting-nx/migration-angularjs)
- [Using Tailwind CSS with Angular projects](/recipes/other/using-tailwind-css-with-angular-projects)
