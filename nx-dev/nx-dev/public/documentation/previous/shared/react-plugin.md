# Nx Plugin for React

The Nx Plugin for React contains schematics for managing React applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, and Storybook.
- Scaffolding for state management with Redux Toolkit libraries.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Adding the React plugin

Adding the React plugin to a workspace can be done with the following:

```shell script
#yarn
yarn add -D @nrwl/react
```

```shell script
#npm
npm install -D @nrwl/react
```

> Note: You can create a new workspace that has React set up by doing `npx create-nx-workspace@latest --preset=react`

The file structure for a React application looks like:

```treeview
myorg/
├── apps/
│   ├── myapp/
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

## See Also

- [Using Cypress](/{{framework}}/plugins/cypress/overview)
- [Using Jest](/{{framework}}/plugins/jest/overview)
- [Using Storybook](/{{framework}}/plugins/storybook/overview)

## Builders

React applications are built using the builders from the `@nrwl/web` plugin.

- [build](/{{framework}}/plugins/web/builders/build) - Builds a web components application
- [dev-server](/{{framework}}/plugins/web/builders/package) - Builds and serves a web application
- [package](/{{framework}}/plugins/web/builders/package) - Bundles artifacts for a buildable library that can be distributed as an NPM package.

## Schematics

- [application](/{{framework}}/plugins/react/schematics/application) - Create an React application
- [component](/{{framework}}/plugins/react/schematics/component) - Create an React library
- [library](/{{framework}}/plugins/react/schematics/library) - Create an React library
- [redux](/{{framework}}/plugins/react/schematics/redux) - Generate a Redux slice for a project
- [storybook-configuration](/{{framework}}/plugins/react/schematics/storybook-configuration) - Set up Storybook for a react library
