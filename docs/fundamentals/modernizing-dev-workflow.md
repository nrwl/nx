# Modernizing Your Dev Workflow

Using Nx, you can add Cypress, Jest, Prettier, and Nest into your dev workflow.

Of course, it's not the case that Cypress is always better than Protractor or Nest is always better than say Express. There are tradeoffs. But in many situations, for many projects, these innovative tools offer a lot of advantages.

Adding these tools to the dev workflow is challenging in a regular CLI project. The choice you have is not between Protractor or Cypress, but between a hacked-up setup for Cypress and a great CLI setup for Protractor. Nx changes that!

## Nest

![NestJS logo](./nest-logo.png)

Nest is a Node.js framework designed for building scalable server-side applications. In many ways, Nest is familiar to Angular developers:

- It has excellent TypeScript support.
- Its dependency injection system is similar to the one in Angular.
- It emphasises testability.
- Its configuration APIs are similar to Angular as well.

Many conventions and best practices used in Angular applications can be also be used when using Nest.

To create a new Nest application, run:

```bash
ng g node-application api # you can also be explicit and pass `--framework=nestjs`
```

This will create the following:

```console
apps/
  api/
    src/
      app/
        app.module.ts
        app.controller.ts
        app.controller.spec.ts
        app.service.ts
        app.service.spec.ts
      assets/
        ...
      environments/
        environment.ts
        environment.prod.ts
      main.ts
    jest.config.js
    tsconfig.json
    tsconfig.app.json
    tsconfig.spec.json
    tslint.json
    proxy.conf.json
libs/
  ...
tools/
  ...
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

You can run:

- `ng serve api` to serve the application
- `ng build api` to build the application
- `ng test api` to test the application

Adding a Nest app will also add Nest schematics to the workspace, which you can run as follows:

```bash
ng generate @nestjs/schematics:controller mycontroller --sourceRoot=apps/nestapp/src --path=app
```

The best way to discover what schematics Nest provides is by using Angular Console:

SCREENSHOT

Read more about Nest at [nestjs.com](https://nestjs.com).

### Using Express

To create an express application, run `ng g node-application api --framework=express`.

### Using Other Framework

To create an empty node application, run `ng g node-application api --framework=none`.

## Cypress

![Cypress logo](./cypress-logo.png)

Cypress is an e2e test runner built for modern web. It has a lot of great features:

- Time travel
- Real time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

By default, when creating a new Angular application, Nx will use Cypress to create the e2e tests project.

So running `ng g application frontend` will create:

```console
apps/
  frontend/
    ...
  frontend-e2e/
    src/
      fixtures/
        example.json
      integration/
        app.spec.ts
      plugins/
        index.ts
      support/
        app.po.ts
        commands.ts
        index.ts
    cypress.json
    tsconfig.e2e.json
    tsconfig.json

libs/
  ...
tools/
  ...
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

You can run:

- `ng e2e frontend-e2e` to run e2e tests
- `ng e2e frontend-e2e --watch` to run e2e tests in the watch mode
- `ng e2e frontend-e2e --headless` to run e2e tests in the headless mode (used in CI)

Read more about Cypress at [cypress.io](https://cypress.io).

### Using Protractor

To use Protractor instead of Cypress, run `ng g application frontend --e2e-test-runner=protractor`.

## Jest

![Jest logo](./jest-logo.png)

Jest is a fast 0-setup testing framework from Facebook.

By default, Nx uses Jest for both Angular and Node.js applications. So if you run `ng g application frontend`, you will get:

```console
apps/
  frontend/
    src/
      app/
      assets/
      environments/
      favicon.ico
      index.html
      main.ts
      polyfills.ts
      styles.css
      test.ts
    browserslist
    jest.conf.js
    tsconfig.json
    tsconfig.app.json
    tsconfig.spec.json
    tslint.json
  frontend-e2e/
    ...
libs/
  ...
tools/
  ...
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

Read more about Jest at [jestjs.io](https://jestjs.io).

### Using Karma

To use Karma instead of Jest, run `ng g application frontend --unit-test-runner=karma`.

## Prettier

![Prettier logo](./prettier-logo.png)

Prettier is an opinionated code formatter. An Nx workspace comes with Prettier preconfigured.

```cosnole
apps/
libs/
tools/
.prettierrc # prettier config
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

You can run:

- `yarn format:write` to format the files
- `yarn format:check` to check the formatted files
