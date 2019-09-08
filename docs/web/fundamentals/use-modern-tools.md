# Using Modern Tools

Using Nx, you can add Cypress, Jest, Prettier, and Nest into your dev workflow.

Of course, it's not the case that Cypress is always better than Protractor or Nest is always better than say Express. There are tradeoffs. But in many situations, for many projects, these innovative tools offer a lot of advantages.

## Next.js

Next.js is a React framework designed for building server-prerendered applications.

Add the Nex.js capability to your workspace:

```bash
yarn add --dev @nrwl/next
```

To create the new Next.js application:

```bash
nx g @nrwl/next:application tasks
```

You can run:

- `nx serve tasks` to serve the application
- `nx build tasks` to build the application
- `nx test tasks` to test the application
- `nx e2e tasks-e2e` to run e2e tests for the application

Read more about Next.js at [nextjs.org](https://nextjs.org).

## Nest

![NestJS logo](/shared/nest-logo.png)

Nest is a Node.js framework designed for building scalable server-side applications.

Add the Nest capability to your workspace:

```bash
yarn add --dev @nrwl/nest
```

To create the new Nest application:

```bash
nx g @nrwl/nest:application api
```

The following folders and files are created:

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
│       └── tsconfig.spec.json
├── libs/
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

You can run:

- `nx serve api` to serve the application
- `nx build api` to build the application
- `nx test api` to test the application

Adding a Nest app will also add Nest schematics to the workspace, which you can run as follows:

```bash
nx generate @nestjs/schematics:controller mycontroller --sourceRoot=apps/nestapp/src --path=app
```

Read more about Nest at [nestjs.com](https://nestjs.com).

### Using Express

To use [Express](https://express.org), add the Express capability to your workspace:

```bash
yarn add --dev @nrwl/express
```

To create an express application, run:

```bash
nx g @nrwl/express:application api
```

### Using Other Frameworks

For an empty node application, add the Node capability to your workspace:

```bash
yarn add --dev @nrwl/node
```

To create a Node Application:

```bash
nx g @nrwl/node:application api
```

## Cypress

![Cypress logo](/shared/cypress-logo.png)

Cypress is an e2e test runner built for modern web. It has a lot of great features:

- Time travel
- Real time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

By default, when creating a new web application, Nx will use Cypress to create the e2e tests project.

Running `nx g @nrwl/web:application frontend` will create:

```treeview
<workspace name>/
├── apps/
│   ├── myapp/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── myapp-e2e/
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
│       ├── cypress.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── libs/
├── tools/
├── README.md
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

You can run:

- `nx e2e frontend-e2e` to run e2e tests
- `nx e2e frontend-e2e --watch` to run e2e tests in the watch mode
- `nx e2e frontend-e2e --headless` to run e2e tests in the headless mode (used in CI)

Read more about Cypress at [cypress.io](https://cypress.io).

## Jest

![Jest logo](/shared/jest-logo.png)

Jest is a fast 0-setup testing framework from Facebook.

By default, Nx uses Jest for both Web and Node.js applications. So if you run `nx g application frontend`, you will get:

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
│   │   └── tsconfig.spec.json
│   └── frontend-e2e/
├── libs/
├── tools/
├── README.md
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

Read more about Jest at [jestjs.io](https://jestjs.io).

## Prettier

![Prettier logo](/shared/prettier-logo.png)

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
└── tsconfig.json
```

You can run:

- `nx format:write` to format the files
- `nx format:check` to check the formatted files

Read more about [Prettier](https://prettier.io).
