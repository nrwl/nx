# Using Modern Tools

Using Nx, you can add Cypress, Jest, Prettier, and Nest into your dev workflow.

Of course, it's not the case that Cypress is always better than Protractor or Nest is always better than say Express. There are tradeoffs. But in many situations, for many projects, these innovative tools offer a lot of advantages.

## Nest

![NestJS logo](./nest-logo.png)

Nest is a Node.js framework designed for building scalable server-side applications.

To create a new Nest application, run:

```bash
yarn add --dev @nrwl/nest # Add Nest Capabilities to a workspace
yarn g @nrwl/nest:application api # Create a Nest App
```

This will create the following:

```treeview
<workspace name>/
├── apps/
│   └── api/
│       ├── jest.conf.js
│       ├── proxy.conf.json
│       ├── src/
│       │   ├── app/
│       │   │   ├── app.controller.ts
│       │   │   ├── app.controller.spec.ts
│       │   │   ├── app.module.ts
│       │   │   ├── app.service.ts
│       │   │   └── app.service.spec.ts
│       │   ├── assets/
│       │   ├── environments/
│       │   └── main.ts
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── libs/
├── workspace.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

You can run:

- `ng serve api` to serve the application
- `ng build api` to build the application
- `ng test api` to test the application

Adding a Nest app will also add Nest schematics to the workspace, which you can run as follows:

```bash
ng generate @nestjs/schematics:controller mycontroller --sourceRoot=apps/nestapp/src --path=app
```

Read more about Nest at [nestjs.com](https://nestjs.com).

### Using Express

To create an express application, run:

```bash
yarn add --dev @nrwl/express # Add Express Capabilities to a workspace
ng g @nrwl/express:application api # Create an Express Application
```

### Using Other Frameworks

To create an empty node application, run:

```bash
yarn add --dev @nrwl/node # Add Node Capabilities to a workspace
ng g @nrwl/node:application api # Create a Node Application
```

## Cypress

![Cypress logo](../../shared/cypress-logo.png)

Cypress is an e2e test runner built for modern web. It has a lot of great features:

- Time travel
- Real time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

By default, when creating a new React application, Nx will use Cypress to create the e2e tests project.

So running `ng g @nrwl/react:application frontend` will create:

```treeview
<workspace name>/
├── apps/
│   ├── frontend/
│   └── frontend-e2e/
│       ├── cypress.json
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── tsconfig.e2e.json
│       ├── tsconfig.json
│       └── tslint.json
├── libs/
├── README.md
├── workspace.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

You can run:

- `ng e2e frontend-e2e` to run e2e tests
- `ng e2e frontend-e2e --watch` to run e2e tests in the watch mode
- `ng e2e frontend-e2e --headless` to run e2e tests in the headless mode (used in CI)

Read more about Cypress at [cypress.io](https://cypress.io).

## Jest

![Jest logo](../../shared/jest-logo.png)

Jest is a fast 0-setup testing framework from Facebook.

By default, Nx uses Jest for both React and Node.js applications. So if you run `ng g application frontend`, you will get:

```treeview
<workspace name>/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── frontend-e2e/
├── libs/
├── tools/
├── README.md
├── workspace.json
├── nx.json
├── package.json
├── tsconfig.json
└── tslint.json
```

Read more about Jest at [jestjs.io](https://jestjs.io).

## Prettier

![Prettier logo](./prettier-logo.png)

Prettier is an opinionated code formatter. An Nx workspace comes with Prettier preconfigured.

```treeview
<workspace name>/
├── apps/
├── libs/
├── tools/
├── workspace.json
├── nx.json
├── README.md
├── package.json
├── .prettierrc # prettier config
├── .prettierignore # config to ignore files from prettier
├── tsconfig.json
└── tslint.json
```

You can run:

- `yarn format:write` to format the files
- `yarn format:check` to check the formatted files

Read more about [Prettier](https://prettier.io).
