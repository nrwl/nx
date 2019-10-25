# Getting Started

## Overview

This page shows you how to get up and running quickly with an Nx workspace.

## Creating the workspace

You get started with Nx by running a command that uses your package manager to setup your initial workspace.

**Using `npx`**

```bash
npx create-nx-workspace@latest myworkspace
```

**Using `npm init`**

```bash
npm init nx-workspace myworkspace
```

**Using `yarn create`**

```bash
yarn create nx-workspace myworkspace
```

After creating the workspace, change into the newly created workspace directory.

```bash
cd myworkspace
```

### Adding to an Existing Angular CLI workspace

If you already have a regular Angular CLI project, you can add Nx power-ups by running:

```bash
ng add @nrwl/workspace
```

## Adding Capabilities

If you haven't specified any presets, you will get an empty Nx workspace. There are no applications to build, serve, and test. You can run the following to add capabilities to the workspace:

**Using `npm`**

```bash
npm install --save-dev @nrwl/angular # Adds Angular capabilities
npm install --save-dev @nrwl/web # Adds Web capabilities
npm install --save-dev @nrwl/react # Adds React capabilities
npm install --save-dev @nrwl/node # Adds Node capabilities
npm install --save-dev @nrwl/express # Adds Express capabilities
npm install --save-dev @nrwl/nest # Adds Nest capabilities
npm install --save-dev @nrwl/next # Adds Next.js capabilities
```

**Using `yarn`**

```bash
yarn add --dev @nrwl/react # Adds React capabilities
yarn add --dev @nrwl/web # Adds Web capabilities
yarn add --dev @nrwl/angular # Adds Angular capabilities
yarn add --dev @nrwl/node # Adds Node capabilities
yarn add --dev @nrwl/express # Adds Express capabilities
yarn add --dev @nrwl/nest # Adds Nest capabilities
yarn add --dev @nrwl/next # Adds Next.js capabilities
```

**Using `ng add`**

```bash
ng add @nrwl/angular # Adds Angular capabilities
ng add @nrwl/web # Adds Web capabilities
ng add @nrwl/react # Adds React capabilities
ng add @nrwl/node # Adds Node capabilities
ng add @nrwl/express # Adds Express capabilities
ng add @nrwl/nest # Adds Nest capabilities
ng add @nrwl/next # Adds Next.js capabilities
```

## Discover Capabilities

Nx comes with a `list` feature which enables you to see the capabilities that have been added to your workspace.

```bash
nx list
```

This will output a list of all the plugins you have just added, alongside some that Angular comes with out of the box like `@schematics/angular`.

To list the capabilities within a specific plugin :

```bash
nx list @nrwl/web
```

This will list all the capabilities in the `@nrwl/web` collection.

`nx list` will also output a list of Nrwl-approved plugins that you may want to consider adding to your workspace.

## Creating an application

After the capability is added, you can now create your first application via:

```bash
ng g @nrwl/angular:application myapp
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
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
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
│       ├── tsconfig.json
│       └── tslint.json
├── libs/
├── tools/
├── README.md
├── angular.json
├── nx.json
├── package.json
├── tsconfig.json
└── tslint.json
```

All the files that the Angular CLI would have in a new project are still here, just in a different folder structure which makes it easier to create more applications and libraries in the future.

## Serving an Application

To serve the newly generated application, run:

```bash
nx serve myapp
```

When the app is ready, visit `http://localhost:4200` in your browser.

That's it! You've created your first application in an Nx workspace. To become more familiar with Nx:

- Go through a [complete tutorial](/angular/tutorial/01-create-application) on using Nx to build a full-stack application.

## Using Angular Console

You can also create a new Nx project using [Angular Console](https://angularconsole.com)--UI for the CLI:

![Create Workspace](./create-workspace.gif)
