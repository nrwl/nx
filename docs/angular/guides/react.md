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
happynrwl/
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
├── angular.json
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
happynrwl/
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
├── angular.json
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
import { Home } from '@happynrwl/home';

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
