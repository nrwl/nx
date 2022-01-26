# Angular Plugin

![Angular logo](/shared/angular-logo.png)

The Nx Plugin for Angular contains executors, generators, and utilities for managing Angular applications, and libraries within an Nx workspace. It provides:

- Integration with libraries such as Storybook, Jest, Cypress, Karma and Protractor.
- Generators to help scaffold code quickly, including:
  - Micro Frontends
  - Libraries, both internal to your codebase and publishable to npm
  - Upgrading AngularJS applications
  - Single Component Application Modules (SCAMs)
- NgRx helpers.
- Utilities for automatic workspace refactoring.

## Setting up the Angular plugin

Adding the Angular plugin to an existing Nx workspace can be done with the following:

```bash
yarn add -D @nrwl/angular
```

```bash
npm install -D @nrwl/angular
```

## Using the Angular Plugin

### Generating an application

It's straightforward to generate an Angular application:

```bash
nx g @nrwl/angular:app appName
```

By default, the application will be generated with:

- ESLint as the linter.
- Jest as the unit test runner.
- Cypress as the E2E test runner.

We can then serve, build, test, lint and run e2e tests on the application with the following commands:

```bash
nx serve appName
nx build appName
nx test appName
nx lint appName
nx e2e appName
```

### Generating an library

Generating an Angular library is very similar to generating an application:

```bash
nx g @nrwl/angular:lib libName
```

By default, the library will be generated with:

- ESLint as the linter.
- Jest as the unit test runner.

We can then test and lint the library with the following commands:

```bash
nx test libName
nx lint libName
```

[Read more about generating libraries, including buildable and publishable libraries.]()

## More Documentation

- [Angular Nx Tutorial](/angular-tutorial/01-create-application)
- [Setup a Micro Frontend with Angular and Nx](/guides/setup-mfe-with-angular)
- [Using NgRx](/guides/misc-ngrx)
- [Using DataPersistence](/guides/misc-data-persistence)
- [Upgrading an AngularJS application to Angular](/guides/misc-upgrade)
