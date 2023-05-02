<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx.png" width="600" alt="Nx - Smart, Fast and Extensible Build System"></p>

<hr>

# Nx: Smart, Fast and Extensible Build System

Nx is a next generation build system with first class monorepo support and powerful integrations.

This package is a Rspack plugin for Nx.

## Getting Started

Use `--preset=@nrwl/rspack` when creating new workspace.

e.g.

```bash
npx create-nx-workspace@latest rspack-demo --preset=@nrwl/rspack
```

Now, you can go into the `rspack-demo` folder and start development.

```bash
cd rspack-demo
npm start
```

You can also run lint, test, and e2e scripts for the project.

```bash
npm run lint
npm run test
npm run e2e
```

## Existing workspaces

You can add Rspack to any existing Nx workspace.

First, install the plugin:

```bash
npm install --save-dev @nrwl/rspack
```

Then, run the `rspack-project` generator:

```bash
npx nx g @nrwl/rspack:rspack-project --skipValidation
```

**Note:** The `--skipValidation` option allows you to overwrite existing build targets.

## Workspace libraries

The `@nrwl/rspack` executor support importing workspace libs into the app.

```bash
npx nx g @nx/react:lib mylib
```

Import the new library in your app.

```typescript jsx
// src/app/app.tsx
import { Mylib } from '@rspack-demo/mylib';

// ...

export default function App() {
  return <MyLib />;
}
```

Now, run the dev server again to see the new library in action.

```bash
npm start
```

**Note:** You must restart the server if you make any changes to your library.
