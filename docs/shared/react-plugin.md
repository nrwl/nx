# Nx Plugin for React

The Nx Plugin for React contains generators for managing React applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, and Storybook.
- Scaffolding for state management with Redux Toolkit libraries.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Adding the React plugin

Adding the React plugin to a workspace can be done with the following:

```bash
#yarn
yarn add -D @nrwl/react
```

```bash
#npm
npm install -D @nrwl/react
```

> Note: You can create a new workspace that has React set up by doing `npx create-nx-workspace@latest --preset=react`

The file structure for a React application looks like:

```treeview
myorg/
├── apps/
│   ├── myapp/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── myapp-e2e/
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── cypress.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── libs/
├── tools/
├── README.md
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.base.json
```

## See Also

- [Using Cypress](/cypress/overview)
- [Using Jest](/jest/overview)
- [Using Storybook](/storybook/overview-react)

## Executors / Builders

React applications are built using the executors from the `@nrwl/web` plugin.

- [build](/web/build) - Builds a web components application
- [dev-server](/web/package) - Builds and serves a web application
- [package](/web/package) - Bundles artifacts for a buildable library that can be distributed as an NPM package.

## Generators

- [application](/react/application) - Create an React application
- [component](/react/component) - Create an React component
- [library](/react/library) - Create an React library
- [redux](/react/redux) - Generate a Redux slice for a project
- [storybook-configuration](/react/storybook-configuration) - Set up Storybook for a react library
