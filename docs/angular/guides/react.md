# Using React with Nx

With Nx you can build multiple applications and libraries in the same workspace. This approach used by companies like Google and Facebook provides a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience

Nx has first class support for React: you can create React applications and libraries, serve, build, test them similarly to Angular.

## Creating a New Nx Workspace

Create a new Nx workspace. The easiest way to do it is to use npx.

```bash
npx --ignore-existing create-nx-workspace happynrwl --preset=empty
```

You can also create a workspace with a React application in place by running:

```bash
npx --ignore-existing create-nx-workspace happynrwl --preset=react
```

## Adding React capabilities to a workspace

If you used the react preset, you are all set and can skip this. If you created an empty workspace or have an existing workspace, you can add React capabilities to the workspace:

```bash
ng add @nrwl/react
```

## Generating a React Application

Run

```bash
ng g @nrwl/react:app frontend
```

and you will see the following:

```treeview
myworkspace/
├── README.md
├── angular.json
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.css
│   │   │   │   ├── app.spec.tsx
│   │   │   │   └── app.tsx
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.css
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.conf.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── frontend-e2e/
│   │   ├── src/
│   │   │   ├── integrations/
│   │   │   │   └── app.spec.ts
│   │   │   ├── fixutres/
│   │   │   ├── plugins/
│   │   │   └── support/
│   │   ├── cypress.json
│   │   ├── tsconfig.e2e.json
│   │   └── tslint.json
├── libs/
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

Run:

- `ng serve frontend` to serve the application
- `ng build frontend` to build the application
- `ng lint frontend` to lint the application
- `ng test frontend` to test the application using Jest
- `ng e2e frontend-e2e` to test the application using Cypress

As with Angular and Node, when using React in Nx, you get the out-of-the-box support for TypeScript, Cypress, Jest. No need to configure anything: watch mode, source maps, and typings just work.

## Generating a React Library

Run

```bash
ng g @nrwl/react:lib home
```

and you will see the following:

```treeview
myworkspace/
├── README.md
├── angular.json
├── apps/
│   ├── frontend/
│   └── frontend-e2e/
├── libs/
│   └── home/
│       ├── src/
│       │   ├── lib/
│       │   │    ├── home.css
│       │   │    ├── home.tsx
│       │   │    └── home.spec.tsx
│       │   └ index.ts
│       ├── jest.config.js
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

Run:

- `ng test home` to test the library
- `ng lint home` to lint the library

## Using the Library in an Application

You can import the home library into the frontend application like this.

```typescript jsx
import { Component } from 'react';
import { Home } from '@myworkspace/home';

import './app.css';

export class App extends Component {
  render() {
    return (
      <>
        <Home />
        <div>rest of app component</div>
      </>
    );
  }
}
```

## Sharing Code

Without Nx, creating a new shared library can take from several hours or even weeks: a new repo needs to be provisioned, CI needs to be set up, etc.. In an Nx Workspace, it only takes minutes.

You can share React components between multiple React applications. You can also share web components between React and Angular applications. You can even share code between the backend and the frontend. All can be done without any unnecessary ceremony.

## Understanding Your Nx Workspace

An Nx workspace can contain dozens (or hundreds) of applications and libraries. They all may depend on one another and without Nx, it is difficult to understand the implications of a particular change.

Previously, some senior architect would create an ad-hoc dependency diagram and upload it to a corporate wiki. The diagram is not correct even on Day 1, and gets more and more out of sync with every passing day.

With Nx, you can do better than that. You can run `yarn dep-graph` to see a current dependency diagram of the workspace: what apps and libs are there, how they depend on each other, what is loaded lazily and what is not. Nx uses code analysis to collect this information.

![Monorepo Diagram](../fundamentals/monorepo-diagram.png)

It can also help you answer questions like "what apps will have to be redeployed if I change this file?"

![Monorepo Diagram Affected](../fundamentals/monorepo-diagram-affected.png)

Because Nx understands how our applications and libraries depend on each other, it can verify that a code change to a reusable library does not break any applications and libraries depending on it.

```bash
yarn affected:apps # prints the apps affected by a PR

yarn affected:build # reruns build for all the projects affected by a PR

yarn affected:test # reruns unit tests for all the projects affected by a PR

yarn affected:e2e # reruns e2e tests for all the projects affected by a PR

yarn affected --target=lint # reruns any target (for instance lint) for projects affected by a PR
```

Nx will topologically sort the projects, and will run what it can in parallel. The fact that Nx can use its dependency graph to rebuild and retest the minimal number of projects necessary is crucial. Without this the repo will not scale beyond a handful of projects.

You can read more about how Nx help you build like google [here](../fundamentals/develop-like-google).
