# Step 1: Create Application

In this tutorial you will use Nx to build a full-stack application out of common libraries using modern technologies.

## Create a New Workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest myorg
```

When asked about 'preset', select `empty`.

```treeview
myorg/
├── apps/
├── libs/
├── tools/
├── nx.json
├── workspace.json
├── package.json
├── tsconfig.json
├── tslint.json
└── README.md
```

This is an empty Nx workspace without any applications or libraries: nothing to run and nothing to test.

## Create an React Application

First, we must add the capability to create [React](https://reactjs.org/) applications via:

```bash
npm install --save-dev @nrwl/react
```

or

```bash
yarn add --dev @nrwl/react
```

Now, create your first React application.

```bash
ng g @nrwl/react:application todos
```

Nx will ask you a few questions about the application you are trying to create: the directory it will be placed it, the tags used for linting, etc.. As your workspace grows, those things become really important. For now the default answers are good enough.

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
│   │   │   ├── main.tsx
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
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
├── README.md
├── workspace.json
├── nx.json
├── package.json
├── tsconfig.json
└── tslint.json
```

The generate command added two projects to our workspace:

- A React application
- E2E tests for the React application

## Serve the newly created application

Now that the application is setup, run it locally via:

```bash
ng serve todos
```

!!!!!
Open http://localhost:4200 in the browser. What do you see?
!!!!!
Page saying "This is an React app built with Nx"
Page saying "This is an React app built with Create React App"
404
