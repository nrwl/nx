# Getting Started

## TLDR

```bash
npx create-nx-workspace myapp --preset=angular
cd myapp
ng serve myapp
```

## Creating an Nx Workspace

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

### Adding to an Existing Angular CLI workspace

If you already have a regular Angular CLI project, you can add Nx power-ups by running:

```bash
ng add @nrwl/workspace
```

## Adding Capabilities

If you haven't specified any presets, you will get an empty Nx workspace. There are no applications to build, serve, and test. You can run the following to add capabilities to the workspace:

**Using `npm`**

```bash
npm install --dev @nrwl/angular # Adds Angular capabilities
npm install --dev @nrwl/web # Adds Web capabilities
npm install --dev @nrwl/react # Adds React capabilities
npm install --dev @nrwl/node # Adds Node capabilities
npm install --dev @nrwl/express # Adds Express capabilities
npm install --dev @nrwl/nest # Adds Nest capabilities
```

**Using `yarn`**

```bash
yarn add --dev @nrwl/react # Adds React capabilities
yarn add --dev @nrwl/web # Adds Web capabilities
yarn add --dev @nrwl/angular # Adds Angular capabilities
yarn add --dev @nrwl/node # Adds Node capabilities
yarn add --dev @nrwl/express # Adds Express capabilities
yarn add --dev @nrwl/nest # Adds Nest capabilities
```

**Using `ng add`**

```bash
ng add @nrwl/angular # Adds Angular capabilities
ng add @nrwl/web # Adds Web capabilities
ng add @nrwl/react # Adds React capabilities
ng add @nrwl/node # Adds Node capabilities
ng add @nrwl/express # Adds Express capabilities
ng add @nrwl/nest # Adds Nest capabilities
```

## Creating Your First Application

After the capability is added, you can now create your first application via:

```bash
ng g @nrwl/angular:application myapp
```

The result will look like this:

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

## Serving Application

Run `ng serve myapp` to serve the newly generated application!

## Using Angular Console

You can also create a new Nx project using [Angular Console](https://angularconsole.com)--UI for the CLI:

![Create Workspace](./create-workspace.gif)
