# Getting Started

## TLDR

```bash
npx create-nx-workspace myapp --preset=web
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

## Adding Capabilities

If you haven't specified any presets, you will get an empty Nx workspace. There are no applications to build, serve, and test. You can run the following to add capabilities to the workspace:

**Using `npm`**

```bash
npm install --save-dev @nrwl/web # Adds Web capabilities
npm install --save-dev @nrwl/react # Adds React capabilities
npm install --save-dev @nrwl/angular # Adds Angular capabilities
npm install --save-dev @nrwl/node # Adds Node capabilities
npm install --save-dev @nrwl/express # Adds Express capabilities
npm install --save-dev @nrwl/nest # Adds Nest capabilities
```

**Using `yarn`**

```bash
yarn add --dev @nrwl/web # Adds Web capabilities
yarn add --dev @nrwl/react # Adds React capabilities
yarn add --dev @nrwl/angular # Adds Angular capabilities
yarn add --dev @nrwl/node # Adds Node capabilities
yarn add --dev @nrwl/express # Adds Express capabilities
yarn add --dev @nrwl/nest # Adds Nest capabilities
```

## Creating Your First Application

After the capability is added, you can now create your first application via:

```bash
ng g @nrwl/web:application myapp
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
│   │   │   └── styles.css
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
├── workspace.json
├── nx.json
├── package.json
├── tsconfig.json
└── tslint.json
```

## Serving Application

Run `ng serve myapp` to serve the newly generated application!
