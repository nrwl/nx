# Step 1: Create Application

In this tutorial you will use Nx to build a full-stack application out of common libraries using modern technologies like Cypress and Nest.

## Create a New Workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest myorg
```

When asked about 'preset', select `empty`, and `Angular CLI` for the CLI.

```treeview
myorg/
├── apps/
├── libs/
├── tools/
├── nx.json
├── angular.json
├── package.json
├── tsconfig.json
├── tslint.json
└── README.md
```

This is an empty Nx workspace without any applications or libraries: nothing to run and nothing to test.

## Create an Angular Application

First, we must add the capability to create [Angular](https://angular.io) applications via:

```bash
ng add @nrwl/angular --defaults
```

Now, create your first Angular application.

```bash
ng g @nrwl/angular:application todos
```

Nx will ask you a few questions about the application you are trying to create: the directory it will be placed in, the tags used for linting, etc. As your workspace grows, those things become really important. For now the default answers are good enough.

After this is done, you should see something like this:

```treeview
myorg/
├── apps/
│   ├── todos/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.conf.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── todos-e2e/
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
│       ├── tsconfig.json
│       └── tslint.json
├── libs/
├── tools/
├── angular.json
├── nx.json
├── package.json
├── tsconfig.json
├── tslint.json
└── README.md
```

The generate command added two projects to our workspace:

- An Angular application
- E2E tests for the Angular application

## Serve the newly created application

Now that the application is setup, run it locally via:

```bash
ng serve todos
```

!!!!!
Open http://localhost:4200 in the browser. What do you see?
!!!!!
Page saying "This is an Angular app built with Nx"
Page saying "This is an Angular app built with the Angular CLI"
404
