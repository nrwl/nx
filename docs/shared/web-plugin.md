# Nx Plugin for Web Components

The Nx Plugin for Web Components contains schematics for managing Web Component applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, and Storybook.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Adding the Web Components plugin

Adding the Web Components plugin to a workspace can be done with the following:

```shell script
#yarn
yarn add -D @nrwl/web
```

```shell script
#npm
npm install -D @nrwl/web
```

> Note: You can create new workspace that has Web Components set up by doing `npx create-nx-workspace@latest --preset=web-components`

The file structure for a Web Components application looks like:

```treeview
myorg/
├── apps/
│   ├── todos/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── todos-e2e/
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
└── tsconfig.json
```

## See Also

- [Using Cypress](/react/guides/modernize-cypress)
- [Using Jest](/react/guides/modernize-jest)

## Builders

- [build](/web/api/web/builders/build) - Builds a web components application
- [dev-server](/web/api/web/builders/package) - Builds and serves a web application
- [package](/web/api/web/builders/package) - Bundles artifacts for a buildable library that can be distributed as an NPM package.

## Schematics

- [application](/react/api/react/schematics/application) - Create an Web Components application
- [component](/react/api/react/schematics/component) - Create an Web Components library
- [library](/react/api/react/schematics/library) - Create an Web Components library
- [redux](/react/api/react/schematics/redux) - Generate a Redux slice for a project
- [storybook-configuration](/react/api/react/schematics/storybook-configuration) - Set up Storybook for a react library
