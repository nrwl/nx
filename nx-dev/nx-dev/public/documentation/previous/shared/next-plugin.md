# Next.js Plugin

The Nx Plugin for Next.js contains executors and generators for managing Next.js applications and libraries within an Nx workspace. It provides:

- Scaffolding for creating, building, serving, linting, and testing Next.js applications.
- Integration with building, serving, and exporting a Next.js application.
- Integration with React libraries within the workspace.

## Installing the Next.js Plugin

Installing the Next plugin to a workspace can be done with the following:

```shell script
yarn add -D @nrwl/next
```

```shell script
npm install -D @nrwl/next
```

## Applications

Generating new applications can be done with the following:

```shell script
nx generate @nrwl/next:application <name>
```

This creates the following app structure:

```treeview
myorg/
├── apps/
│   ├── myapp/
│   │   ├── pages/
│   │   │   ├── index.css
│   │   │   └── index.tsx
│   │   ├── jest.conf.js
│   │   ├── tsconfig.json
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
├── tsconfig.json
└── .eslintrc.json
```

## See Also

- [Using Next.js](https://nextjs.org/docs/getting-started)

## Executors / Builders

- [build](/{{framework}}/next/build) - Builds a Next.js application
- [server](/{{framework}}/next/server) - Builds and serves a Next.js application
- [export](/{{framework}}/next/export) - Export a Next.js app. The exported application is located at `dist/$outputPath/exported`

## Generators

- [application](/{{framework}}/next/application) - Create an Next.js application
