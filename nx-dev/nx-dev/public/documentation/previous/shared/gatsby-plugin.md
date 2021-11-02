# Gatsby Plugin

The Nx Plugin for Gatsby contains executors and generators for managing Gatsby applications and libraries within an Nx workspace. It provides:

- Scaffolding for creating, building, serving, linting, and testing Gatsby applications.
- Integration with building, serving, and exporting a Gatsby application.
- Integration with React libraries within the workspace.

## Installing the Gatsby Plugin

Installing the Gatsby plugin to a workspace can be done with the following:

```bash
yarn add -D @nrwl/gatsby
```

```bash
npm install -D @nrwl/gatsby
```

## Applications

Generating new applications can be done with the following:

```bash
nx generate @nrwl/gatsby:application <name>
```

This creates the following app structure:

```treeview
myorg/
├── apps/
│   ├── myapp/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── index.module.css
│   │   │   │   └── index.tsx
│   │   ├── jest.conf.js
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.spec.json
│   │   └── .eslintrc.json
│   └── myapp-e2e/
│   │   ├── src/
│   │   │   ├── integrations/
│   │   │   │   └── app.spec.ts
│   │   │   ├── fixtures/
│   │   │   ├── plugins/
│   │   │   └── support/
│   │   ├── cypress.json
│   │   ├── tsconfig.e2e.json
│   │   └── .eslintrc.json
├── libs/
├── workspace.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.base.json
└── .eslintrc.json
```

## See Also

- [Using Gatsby](https://www.gatsbyjs.com/docs/quick-start/)

## Executors / Builders

- [build](/{{framework}}/gatsby/build) - Builds a Gatsby application
- [server](/{{framework}}/gatsby/server) - Builds and serves a Gatsby application

## Generators

- [application](/{{framework}}/gatsby/application) - Create a Gatsby application
- [component](/{{framework}}/gatsby/component) - Create a Gatsby component
- [page](/{{framework}}/gatsby/page) - Create a Gatsby page
