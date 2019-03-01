# Getting Started

## Installing Angular CLI

Nx is just a set Angular CLI power-ups, **so an Nx workspace is an Angular CLI workspace**. This means that it will be handy to have the Angular CLI installed globally, which can be done via npm or yarn.

```bash
npm install -g @angular/cli
```

## Creating an Nx Workspace

**Using `npx`**

```bash
npx create-nx-workspace myworkspace
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
ng add @nrwl/schematics
```

## Creating First Application

Unlike the CLI, an Nx workspace starts blank. There are no applications to build, serve, and test. To create one run:

```bash
ng g application myapp
```

The result will look like this:

```treeview
<workspace name>/
├── README.md
├── angular.json
├── apps/
│   ├── myapp/
│   │   ├── browserslist
│   │   ├── jest.conf.js
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
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── myapp-e2e/
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
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

All the files that the CLI would have in a new project are still here, just in a different folder structure which makes it easier to create more applications and libraries in the future.

## Serving Application

Run `ng serve myapp` to serve the newly generated application!

## Using Angular Console

You can also create a new Nx project using Angular Console--UI for the CLI:

![Create Workspace](./create-workspace.gif)
