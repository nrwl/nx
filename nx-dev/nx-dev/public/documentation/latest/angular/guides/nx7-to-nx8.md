# Nx 7 => Nx 8

If you have used Nx since before version 8, things might seem different now. Prior to Nx 8 our packages were `@nrwl/schematics` and `@nrwl/builders`. These packages were organized by which Angular CLI feature they depended on. `@nrwl/schematics` contained the core of Nx + schematics for all of our features: Angular, React, Node, and Nest. This organization had very little meaning to users and made it impossible to install only capabilities needed for Angular. To solve this, in Nx 8, we have organized our packages by feature.

## Upgrading from Nx 7 to Nx 8

To upgrade from a Nx 7 workspace to a Nx 8 workspace, run:

- `ng update @nrwl/schematics@8.4.8` to update the workspace to the Nx 8 format.
- Commit the results
- `ng update @nrwl/workspace@8.4.8` to update the workspace to 8.4.8.

### Potential Issues

- If you use publishable libraries, running `ng update @nrwl/schematics@8.4.8` will incorrectly update the version of `@angular/compiler-cli` and `@angular/language-service`. Update the versions manually before committing the changes. The issue is due to an incorrect peer dependency in `ng-packagr`, which we cannot fix in Nx.
- The schematics section of `angular.json` might still contain references to `@nrwl/schematics`. Update them to point to appropriate package (e.g., `@nrwl/angular`, `@nrwl/react`, `@nrwl/nest`).

## Where you can find familiar features

Below is a guide for users to find where the familiar features from Nx 7 can be found in Nx 8.

### `create-nx-workspace`

`create-nx-workspace` has not moved and remains in the `create-nx-workspace` package.

### The Nx CLI

The `nx` CLI has been moved to `@nrwl/workspace` which contains most of the core of Nx. It is still called `nx` so it can still be found at `./node_modules/.bin/nx`.

#### `affected`, `format`, `lint`, `dep-graph`

All CLI commands, `affected`, `format`, `lint`, and `dep-graph` have been moved to `@nrwl/workspace` as well. These commands are still run the same way via `yarn affected`, `yarn format`, etc..

### Jest Builder

The builder for running Jest tests has been moved to `@nrwl/jest` which contains all of the Jest capabilities and can be specified as follows:

- `@nrwl/builders:jest` is now `@nrwl/jest:jest`

### Cypress Builder

The builder for running Cypress tests has been moved `@nrwl/cypress` which contains all of the Cypress capabilities and can be specified as follows:

- `@nrwl/builders:cypress` is now `@nrwl/cypress:cypress`

### Angular

#### Schematics

All Angular schematics such as `app`, `lib`, `ngrx`, `downgrade-module`, and `upgrade-module` have been moved to `@nrwl/angular` which contains all of the Angular Capabilities. You can generate these same schematics by specifying `@nrwl/angular` as the collection. For example, use `ng g @nrwl/angular:app` to generate an Angular application. If `@nrwl/angular` is the default collection in the workspace, you can continue using `ng g app`.

#### DataPersistence

DataPersistence has been moved to `@nrwl/angular` as well and can be imported from `@nrwl/angular`.

### React

#### Schematics

All React schematics such as `app` and `lib` have been moved to `@nrwl/react` which contains all of the React capabilities. You can generate these same schematics by specifying `@nrwl/react` as the collection. For example, use `ng g @nrwl/react:app` to generate a React application. If `@nrwl/react` is the default collection in the workspace, you can continue to use `ng g app`.

#### Builders

The builders for building and serving React apps has been moved to `@nrwl/web`. The React builder is no different from the one used to bundle normal web applications so `@nrwl/react` depends on that functionality from `@nrwl/web`. You do not need to add `@nrwl/web` yourself as adding `@nrwl/react` will add it's dependencies for you.

### Web

#### Schematics

All Web schematics such as `app` and `lib` have been moved to `@nrwl/web` which contains all of the Web capabilities. You can generate these same schematics by specifying `@nrwl/web` as the collection. For example, use `ng g @nrwl/web:app` to generate a Web application. If `@nrwl/web` is the default collection in the workspace, you can continue to use `ng g app`.

#### Builders

The builders for building and serving Web apps has been moved to `@nrwl/web` and can be specified as follows:

- `@nrwl/builders:web-build` is now `@nrwl/web:build`
- `@nrwl/builders:web-dev-server` is now `@nrwl/web:dev-server`

### Nest

#### Schematics

All Nest schematics such as `app` have been moved to `@nrwl/nest` which contains all of the Nest capabilities. You can generate these same schematics by specifying `@nrwl/nest` as the collection. For example, use `ng g @nrwl/nest:app` to generate a Nest application. If `@nrwl/nest` is the default collection in the workspace, you can use `ng g app` instead of `ng g node-app`.

#### Builders

The builders for building and serving Nest apps has been moved to `@nrwl/node`. The Nest builder is no different from the one used to bundle normal NodeJS applications so `@nrwl/nest` depends on that functionality from `@nrwl/node`. You do not need to add `@nrwl/node` yourself as adding `@nrwl/nest` will add it's dependencies for you.

### Express

#### Schematics

All Express schematics such as `app` have been moved to `@nrwl/express` which contains all of the Express capabilities. You can generate these same schematics by specifying `@nrwl/express` as the collection. For example, use `ng g @nrwl/express:app` to generate an Express application. If `@nrwl/express` is the default collection in the workspace, you can use `ng g app` instead of `ng g node-app`.

#### Builders

The builders for building and serving Express apps has been moved to `@nrwl/node`. The Express builder is no different from the one used to build normal NodeJS applications so `@nrwl/express` depends on that functionality from `@nrwl/node`. You do not need to add `@nrwl/node` yourself as adding `@nrwl/express` will add it's dependencies for you.

### Node

#### Schematics

All Node schematics such as `app` have been moved to `@nrwl/node` which contains all of the Node capabilities. You can generate these same schematics by specifying `@nrwl/node` as the collection. For example, use `ng g @nrwl/node:app` to generate a Node application. If `@nrwl/node` is the default collection in the workspace, you can use `ng g app` instead of `ng g node-app`.

#### Builders

The builder for building and serving Node apps has been moved to `@nrwl/node` and can be specified as follows:

- `@nrwl/builders:node-build` is now `@nrwl/node:build`
- `@nrwl/builders:node-execute` is now `@nrwl/node:execute`
