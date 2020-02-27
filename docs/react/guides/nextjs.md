# Next.js

Nx comes with first-class Next.js support. In this guide we will look at how to use it.

## Creating a New Nx Workspace

Create a new Nx workspace. The easiest way to do it is to use npx.

```bash
npx --ignore-existing create-nx-workspace happynrwl
```

You can also create a workspace with a Next.js application in place by running:

```bash
npx --ignore-existing create-nx-workspace happynrwl --preset=next
```

## Adding Next.js capabilities to a workspace

If you used the Next.js preset, you are all set and can skip this. If you created an empty workspace or have an existing workspace, you can add Next.js capabilities to the workspace:

```bash
yarn add --dev @nrwl/next
```

## Generating a Next.js Application

Run

```bash
nx g @nrwl/next:app tuskdesk
```

and you will see the following:

```treeview
happynrwl/
├── apps/
│   ├── tuskdesk/
│   │   ├── pages/
│   │   │   ├── index.css
│   │   │   └── index.tsx
│   │   ├── jest.conf.js
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── .eslintrc
│   └── tuskdesk-e2e/
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

Run:

- `nx serve tuskdesk` to serve the application
- `nx serve tuskdesk --prod` to serve the application in the production mode
- `nx build tuskdesk` to build the application
- `nx lint tuskdesk` to lint the application
- `nx test tuskdesk` to test the application using Jest
- `nx export tuskdesk` to export the application
- `nx e2e tuskdesk-e2e` to test the application using Cypress

When using Next.js in Nx, you get the out-of-the-box support for TypeScript, Cypress, Jest. No need to configure anything: watch mode, source maps, and typings just work.

## Generating a React Library

Run

```bash
nx g @nrwl/react:lib shared-components
```

and you will see the following:

```treeview
happynrwl/
├── apps/
│   ├── tuskdesk/
│   └── tuskdesk-e2e/
├── libs/
│   └── shared-components/
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
├── workspace.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

Run:

- `nx test shared-components` to test the library
- `nx lint shared-components` to lint the library

## Using the Library in an Application

You can import the shared-components library into the Next.js application like this.

```typescript jsx
import { Home } from '@happynrwl/shared-components';
import React from 'react';

export const Index = () => {
  return (
    <>
      <Home />
      <div>the rest of the component</div>
    </>
  );
};

export default Index;
```

## Sharing Code

Without Nx, creating a new shared library can take from several hours or even weeks: a new repo needs to be provisioned, CI needs to be set up, etc.. In an Nx Workspace, it only takes minutes.

You can share React components between multiple Next.js applications. You can also share web components between Next.js and plain React applications. You can even share code between the backend and the frontend. All can be done without any unnecessary ceremony.
