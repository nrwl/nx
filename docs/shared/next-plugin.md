# Next.js Plugin

The Nx Plugin for Next.js contains builders and schematics for managing Next.js applications and libraries within an Nx workspace. It provides:

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
│   ├── myapp/
│   │   ├── pages/
│   │   │   ├── index.css
│   │   │   └── index.tsx
│   │   ├── jest.conf.js
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── .eslintrc
│   └── myapp-e2e/
│   │   ├── src/
│   │   │   ├── integrations/
│   │   │   │   └── app.spec.ts
│   │   │   ├── fixtures/
│   │   │   ├── plugins/
│   │   │   └── support/
│   │   ├── cypress.json
│   │   ├── tsconfig.e2e.json
│   │   └── .eslintrc
├── libs/
├── workspace.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── .eslintrc
```

## See Also

- [Using Next.js](https://nextjs.org/docs/getting-started)

## Builders

- [build](/{{framework}}/plugins/next/builders/build) - Builds a Next.js application
- [dev-server](/{{framework}}/plugins/next/builders/dev-server) - Builds and serves a Next.js application
- [export](/{{framework}}/plugins/next/builders/package) - Export a Next.js app. The exported application is located at `dist/$outputPath/exported`

## Schematics

- [application](/{{framework}}/plugins/next/schematics/application) - Create an Next.js application
