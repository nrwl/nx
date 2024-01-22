---
title: Deploying Nuxt applications to Vercel
description: A detailed guide on how to deploy Nuxt applications from Nx workspaces to Vercel.
---

# Deploying Nuxt applications to Vercel

## Configure your Nuxt application appropriately for Vercel deployment

In your application's `nuxt.config.ts` file, ensure that the `nitro` property is configured to use the `vercel` preset, and that the `output.dir` property is set to the appropriate directory. The directory that Vercel expects to find the application's build output (as explained in the [Vercel documentation](https://vercel.com/docs/build-output-api/v3)) in is `.vercel/output` at the root of the repository/workspace. So, if your application is located at `apps/my-app` then the `output.dir` property should be set to `../../.vercel/output`.

For example, if your Nx workspace is structured like this:

```treeview
├── apps
│   └── my-app
│       ├── nuxt.config.ts
│       ├── src
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
├── nx.json
├── package-lock.json
├── package.json
└── tsconfig.base.json
```

Then your `nitro` configuration should look like this:

```ts {% fileName="apps/my-app/nuxt.config.ts" %}
  nitro: {
    preset: 'vercel',
    output:{
      dir: '../../.vercel/output'
    }
  },
```

For Vercel deployment, it does not really matter what the `buildDir` property in your `nuxt.config.ts` is set to.

So, your entire `nuxt.config.ts` file may look something like this:

```ts {% fileName="apps/my-app/nuxt.config.ts" %}
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  workspaceDir: '../../',
  srcDir: 'src',
  devtools: { enabled: true },
  buildDir: '../../dist/apps/my-app/.nuxt',
  devServer: {
    host: 'localhost',
    port: 4200,
  },
  typescript: {
    typeCheck: true,
    tsConfig: {
      extends: './tsconfig.app.json',
    },
  },
  imports: {
    autoImport: false,
  },
  css: ['~/assets/css/styles.css'],
  vite: {
    plugins: [nxViteTsPaths()],
  },
  nitro: {
    preset: 'vercel',
    output: {
      dir: '../../.vercel/output',
    },
  },
});
```

## Configure your Vercel project's settings appropriately

### New Vercel project

1. If you are "importing" your Nx workspace's repository for the first time, make sure you do _not_ choose a root directory as part of the repo selection process (therefore leaving it to be the root of the full repo/workspace)
2. Ensure the Nuxt.js "Framework Preset" is selected
3. Expand the "Build & Development Settings" and toggle the override switch for the build command. For example, for an application named `my-app` the value will look like this:

```shell
npx nx build my-app --prod
```

![New Vercel Project](/shared/guides/nuxt-deploy-vercel-1.png)

### Existing Vercel project

If you have an existing project on Vercel then the exact same guidance applies as for the section above, it's just that you will need to update the project's existing settings.

When everything is updated appropriately, for our `my-app` example we would see the following in our "General" settings UI:

![Existing Vercel Project](/shared/guides/nuxt-deploy-vercel-2.png)

## Skipping build if the application is not affected

One of the core features of Nx is to run code quality checks and builds only for projects that are affected by recent code changes. We can use [Vercel's ignored build step feature](https://vercel.com/docs/platform/projects#ignored-build-step) to only build our application if it is affected.

To build only what's affected, use the `npx nx-ignore <app-name>` command under `Project Settings > Git` on Vercel.

![Ignore build step](/shared/guides/nuxt-deploy-vercel-3.png)

The `nx-ignore` command uses Nx to detect whether the current commit affects the specified app, and will skip the build if it is not affected.

## Next steps

Naturally, you can continue on and set any additional Environment Variables etc that may be appropriate for your projects, but we have now covered the key points needed to deploy Nuxt.js projects from Nx workspaces on Vercel!
