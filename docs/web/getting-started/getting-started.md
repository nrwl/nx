# Getting Started

## Overview

This page shows you how to get up and running quickly with an Nx workspace.

## Creating the workspace

You get started with Nx by running a command that uses your package manager to setup your initial workspace.

**Using `npx`**

```bash
npx create-nx-workspace@latest
```

**Using `npm init`**

```bash
npm init nx-workspace
```

**Using `yarn create`**

```bash
yarn create nx-workspace
```

After creating the workspace, change into the newly created workspace directory.

```bash
cd myworkspace
```

## Adding Capabilities

If you haven't specified any presets, you get an empty Nx workspace. There are no applications to build, serve, and test. To add capabilities for React to the workspace:

Using `npm`:

```bash
npm install --save-dev @nrwl/web
```

Using `yarn`:

```bash
yarn add --dev @nrwl/web
```

### Additional Capabilities

Nx also provides capabilities for other platforms, and libraries such as Node, Next.js, Express, and Nest.

To add the additional capabilities:

```bash
npm install --save-dev @nrwl/next
npm install --save-dev @nrwl/node
npm install --save-dev @nrwl/express
npm install --save-dev @nrwl/nest
```

**Using `yarn`**

```bash
yarn add --dev @nrwl/next
yarn add --dev @nrwl/node
yarn add --dev @nrwl/express
yarn add --dev @nrwl/nest
```

## Creating an application

After the capabilities are added, you create your first application using the following command:

```bash
nx generate @nrwl/web:application myapp
```

The following files and folders are generated in the new application:

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

## Serving an application

To serve the newly generated application, run:

```bash
nx serve myapp
```

When the app is ready, visit `http://localhost:4200` in your browser.

That's it! You've created your first application in an Nx workspace. To become more familiar with Nx:

- Go through a [complete tutorial](/web/tutorial/01-create-application) on using Nx to build a full-stack application.
