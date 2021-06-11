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
│   ├── tuskdesk/
│   │   ├── pages/
│   │   │   ├── index.css
│   │   │   └── index.tsx
│   │   ├── jest.conf.js
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── .eslintrc.json
│   └── tuskdesk-e2e/
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
│   ├── tuskdesk/
│   └── tuskdesk-e2e/
├── libs/
│   └── shared-components/
│       ├── src/
│       │   ├── lib/
│       │   │    ├── home.css
│       │   │    ├── home.tsx
│       │   │    └── home.spec.tsx
│       │   └ index.ts
│       ├── jest.config.js
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       ├── tsconfig.spec.json
│       └── tslint.json
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

## Deploying to Vercel

You may know that the company behind Next.js, Vercel, has a great hosting platform offering that is developed in tandem with Next.js itself to offer a great overall developer and user experience.

In order to deploy your Next.js application from your Nx workspace you should do the following:

### Verify the project's next.config.js

Let's continue to use our `tuskdesk` example from above, and so we need to check out our config at `apps/tuskdesk/next.config.js`. If you created the application using a recent (at the time of writing) version of Nx, such as Nx 11, then you will likely see the following in that config by default:

```js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNx = require('@nrwl/next/plugins/with-nx');

module.exports = withNx({});
```

If you have a config which looks like that (leveraging the `withNx()` config plugin) **AND** the version of Nx you are using is `11.1.0` or later, **no further action is needed** in your config.

If, however, you created the application using an older version of Nx, you may just see an empty object:

```js
module.exports = {};
```

If this is the case, or if you are using a version of Nx older than `11.1.0`, then you must do one of the following:

[Option 1] We would naturally highly recommend upgrading to the latest Nx (for many reasons), and updating the next.config.js to match the first example which leverages the `withNx()` config plugin (which as of `11.1.0` sets target to `'experimental-serverless-trace'` behind the scenes for Vercel builds).

[Option 2] If for some reason you cannot upgrade to a version of Nx which provides the updated `withNx()` config plugin, you can manually add a `target` property to your exported config with a value of `'experimental-serverless-trace'`.

E.g.

```js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNx = require('@nrwl/next/plugins/with-nx');

module.exports = withNx({
  target: 'experimental-serverless-trace',
  // ...You can of course have other Next.js config options specified here too, but the "target" is critical for Vercel deployments...
});
```

OR

```js
module.exports = {
  target: 'experimental-serverless-trace',
  // ...You can of course have other Next.js config options specified here too, but the "target" is critical for Vercel deployments...
};
```

> Vercel themselves have informed us that this target will not be required in future versions of Next.js and their platform, but that even when that is the case this option will not cause any issues, so we do not need to worry too much about the name containing "experimental".

### Configure your Vercel project's settings appropriately

#### New Vercel project

1. If you are "importing" your Nx workspace's repository for the first time, make sure you do _not_ choose a root directory as part of the repo selection process (therefore leaving it to be the root of the full repo/workspace)
2. Ensure the Next.js "Framework Preset" is selected
3. Expand the "Build and Output Settings" and toggle the override switch for the build command. For our `tuskdesk` project the value will look like this:

```sh
npx nx build tuskdesk --prod --outputPath=.
```

4. Leave the "Output Directory" option untouched (i.e. do not toggle the override)

> You may be thinking, why don't we just override the Output Directory on Vercel and not set the custom `--outputPath` on the build command? At the time of writing these two things are not equivalent to the Vercel build executor that runs behind the scenes, so setting the `--outputPath` is the most appropriate option.

Therefore, our full configuration (based on a repo called "nx-workspace" and a project called "tuskdesk") will look like this:

![image](https://user-images.githubusercontent.com/900523/104120015-1253c880-534d-11eb-860f-17e756904448.png)

#### Existing Vercel project

If you have an existing project on Vercel then the exact same guidance applies as for the section above, it's just that you will need to update the project's existing settings.

When everything is updated appropriately, for our `tuskdesk` example we would see the following in our "General" settings UI:

![image](https://user-images.githubusercontent.com/900523/104119928-72963a80-534c-11eb-9f0d-e7b4311a22e5.png)

Naturally, you can continue on and set any additional Environment Variables etc that may be appropriate for your projects, but we have now covered the key points needed to deploy Next.js projects from Nx workspaces on Vercel!
