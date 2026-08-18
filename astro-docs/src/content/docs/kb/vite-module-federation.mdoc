---
title: Vite Module Federation
description: Set up Module Federation with Vite in an Nx workspace using the @module-federation/vite plugin, with Nx orchestrating the host and remote tasks.
sidebar:
  label: Vite Module Federation
weight: 3
filter: 'type:Guides'
topics:
  - 'Module Federation'
---

You can build a Module Federation setup with [Vite](/docs/technologies/build-tools/vite/introduction) by wiring the [`@module-federation/vite`](https://github.com/module-federation/vite) plugin into each app's `vite.config.ts` directly, while Nx orchestrates the `dev`, `build`, and `preview` tasks across the host and its remotes.

The example below is maintained by [Giorgio Boa](https://x.com/giorgio_boa), creator of the Vite Module Federation plugin, and shows a host that loads a remote at runtime:

{% github_repository url="https://github.com/gioboa/react-nx-microfrontend-demo" /%}

## How it works

The workspace is a pnpm + Nx monorepo with two federated apps and shared workspace packages:

```text
apps/
├── host/          # loads the remote at runtime (the "consumer")
└── remote/        # exposes a component (the "provider")
packages/
└── shared-ui/     # a shared workspace library used by both apps
```

### The remote exposes a component

The remote's `apps/remote/vite.config.ts` registers `@module-federation/vite` and exposes a module under a public key. It emits a `remoteEntry.js` that the host loads at runtime:

```ts
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [
    federation({
      name: 'remote',
      filename: 'remoteEntry.js',
      exposes: {
        './remote-app': './src/App.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
    react(),
  ],
}));
```

### The host consumes the remote

The host's `apps/host/vite.config.ts` points at the remote's `remoteEntry.js` URL, and `apps/host/src/App.tsx` lazy-loads the exposed module behind `Suspense`:

```ts
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [
    federation({
      name: 'host',
      remotes: {
        remote: {
          type: 'module',
          name: 'remote',
          entry: 'http://localhost:4174/remoteEntry.js',
        },
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
    react(),
  ],
}));
```

```tsx
import { lazy, Suspense } from 'react';

// @ts-ignore - federated module resolved at runtime
const Remote = lazy(() => import('remote/remote-app'));

export default () => (
  <Suspense fallback="loading...">
    <Remote />
  </Suspense>
);
```

### Sharing dependencies

Both apps mark `react` and `react-dom` as `singleton` so a single copy is loaded at runtime, and they consume the same `shared-ui` workspace library. This keeps the host and remote on one shared instance instead of bundling duplicates.

### Nx orchestrates the tasks

Nx is not the federation mechanism here. It runs the tasks. The `nx.json` `targetDefaults` make `dev` and `preview` continuous tasks and have each app build its dependencies first:

```json
{
  "targetDefaults": {
    "dev": { "continuous": true, "dependsOn": ["^build"] },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"]
    },
    "preview": { "continuous": true, "dependsOn": ["build"] }
  }
}
```

Run the host and remote together with a single command:

```shell
nx run-many -t preview
```

## Try it

```shell
git clone https://github.com/gioboa/react-nx-microfrontend-demo
cd react-nx-microfrontend-demo
pnpm install
pnpm run preview
```

Then open `http://localhost:4173/` to see the host rendering the federated remote component.
