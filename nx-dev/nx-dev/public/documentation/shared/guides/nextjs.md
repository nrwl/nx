# Next.js with Nx

![](/shared/nextjs-logo.png)

Nx provides a holistic dev experience powered by an advanced CLI and editor plugins. It provides rich support for common tools like [Cypress](/cypress/overview), Storybook, Jest, and more.

In this guide we will show you how to develop [Next.js](https://nextjs.org/) applications with Nx.

## Creating Nx Workspace

The easiest way to create your workspace is via `npx`.

```bash
npx create-nx-workspace happynrwl \
--preset=next \
--style=css \
--appName=tuskdesk
```

**Note:** You can also run the command without arguments to go through the interactive prompts.

```bash
npx create-nx-workspace happynrwl
```

Once the command completes, the workspace will look as follows:

```treeview
happynrwl/
├── apps/
│   ├── tuskdesk/
│   │   ├── index.d.ts
│   │   ├── jest.config.js
│   │   ├── next-env.d.ts
│   │   ├── next.config.js
│   │   ├── pages/
│   │   │   ├── _app.tsx
│   │   │   ├── index.module.css
│   │   │   ├── index.tsx
│   │   │   └── styles.css
│   │   ├── public/
│   │   │   ├── nx-logo-white.svg
│   │   │   └── star.svg
│   │   ├── specs/
│   │   │   └── index.spec.tsx
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── tuskdesk-e2e/
│       ├── cypress.json
│       ├── src/
│       │   ├── fixtures/
│       │   ├── integration/
│       │   ├── plugins/
│       │   └── support/
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── babel.config.json
├── jest.config.js
├── jest.preset.js
├── libs
├── nx.json
├── package-lock.json
├── package.json
├── tools/
│   ├── generators
│   └── tsconfig.tools.json
├── tsconfig.base.json
└── workspace.json
```

Run `npx nx serve tuskdesk` to start the dev server at http://localhost:4200. Try out other commands as well.

- `nx lint tuskdesk` to lint the application
- `nx test tuskdesk` to test the application using Jest
- `nx e2e tuskdesk-e2e` to test the application using Cypress
- `nx build tuskdesk` to build the application
- `nx serve tuskdesk --prod` to serve the application in the production mode

When using Next.js in Nx, you get the out-of-the-box support for TypeScript, Cypress, and Jest. No need to configure anything: watch mode, source maps, and typings just work.

### Adding Next.js to an Existing Workspace

For existing Nx workspaces, install the `@nrwl/next` package to add Next.js capabilities to it.

```bash
npm install @nrwl/next --save-dev

# Or with yarn
yarn add @nrwl/next --dev
```

## Generating an Application

To create additional Next.js apps run:

```bash
npx nx g @nrwl/next:app
```

## Generating a Library

Nx allows you to create libraries with just one command. Some reasons you might want to create a library include:

- Share code between applications
- Publish a package to be used outside the monorepo
- Better visualize the architecture using `npx nx graph`

For more information on Nx libraries, see our documentation on [Creating Libraries](/structure/creating-libraries)
and [Library Types](/structure/library-types).

To generate a new library run:

```bash
npx nx g @nrwl/react:lib shared-ui-layout
```

And you will see the following:

```treeview
happynrwl/
├── apps/
│   └── tuskdesk/
│   └── tuskdesk-e2e/
├── babel.config.json
├── jest.config.js
├── jest.preset.js
├── libs/
│   └── shared-ui-layout/
│       ├── README.md
│       ├── jest.config.js
│       ├── src/
│       │   ├── index.ts
│       │   └── lib
│       ├── tsconfig.json/
│       ├── tsconfig.lib.json
│       └── tsconfig.spec.json
├── nx.json
├── package-lock.json
├── package.json
├── tools/
├── tsconfig.base.json
└── workspace.json
```

Run:

- `npx nx test shared-ui-layout` to test the library
- `npx nx lint shared-ui-layout` to lint the library

### Using Nx Library in your Application

You can import the `shared-ui-layout` library in your application as follows.

```typescript jsx
// apps/tuskapp/pages/index.tsx
import { SharedUiLayout } from '@happynrwl/shared-ui-layout';

export function Index() {
  return (
    <SharedUiLayout>
      <p>The main content</p>
    </SharedUiLayout>
  );
}

export default Index;
```

That's it! There is no need to build the library prior to using it. When you update your library, the Next.js application will automatically pick up the changes.

### Publishable libraries

For libraries intended to be built and published to a registry (e.g. npm) you can use the `--publishable` and `--importPath` options.

```bash
npx nx g @nrwl/react:lib shared-ui-layout --publishable --importPath=@happynrwl/ui-components
```

Run `npx nx build shared-ui-layout` to build the library. It will generate the following:

```treeview
dist/libs/shared-ui-layout/
├── README.md
├── index.d.ts
├── lib
│   └── shared-ui-layout.d.ts
├── package.json
├── shared-ui-layout.esm.css
├── shared-ui-layout.esm.js
├── shared-ui-layout.umd.css
└── shared-ui-layout.umd.js
```

This dist folder is ready to be published to a registry.

## Generating Pages and Components

Nx also provides commands to quickly generate new pages and components for your application.

- `npx nx g @nrwl/next:page about` to add an about page
- `npx nx g @nrwl/next:component banner` to add a banner component

Running the above commands will result in:

```treeview
apps/tuskdesk/
├── components
│   └── banner
│       ├── banner.module.css
│       ├── banner.spec.tsx
│       └── banner.tsx
├── index.d.ts
├── jest.config.js
├── next-env.d.ts
├── next.config.js
├── pages
│   ├── _app.tsx
│   ├── about.module.css
│   ├── about.tsx
│   ├── index.module.css
│   ├── index.tsx
│   └── styles.css
├── public
├── specs
├── tsconfig.json
└── tsconfig.spec.json
```

Nx generates components with tests by default. For pages, you can pass the `--withTests` option to generate tests under the `specs` folder.

Run the tests again for the application: `npx nx test tuskdesk`.

## Code Sharing

Without Nx, creating a new shared library can take from several hours to even weeks: a new repo needs to be provisioned, CI needs to be set up, etc... In an Nx Workspace, it only takes minutes.

You can share React components between multiple Next.js applications. You can also share web components between Next.js and plain React applications. You can even share code between the backend and the frontend. All can be done without any unnecessary ceremony.

## Deploying your Next.js Application

Once you are ready to deploy your Next.js application, you have absolute freedom to choose any hosting provider that fits your needs.

You may know that the company behind Next.js, Vercel, has a great hosting platform offering that is developed in tandem with Next.js itself to offer a great overall developer and user experience. We have detailed [how to deploy your Next.js application to Vercel in a separate guide](/guides/deploy-nextjs-to-vercel).

## Resources

Here are other resources that you may find useful to learn more about Next.js and Nx.

- **Blog post:** [Building a blog with Next.js and Nx Series](https://blog.nrwl.io/create-a-next-js-web-app-with-nx-bcf2ab54613) by Juri Strumpflohner
- **Video tutorial:** [Typescript NX Monorepo with NextJS and Express](https://www.youtube.com/watch?v=WOfL5q2HznI) by Jack Herrington
