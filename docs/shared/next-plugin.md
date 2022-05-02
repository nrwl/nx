![](/shared/nextjs-logo.png)

When using Next.js in Nx, you get the out-of-the-box support for TypeScript, Cypress, and Jest. No need to configure anything: watch mode, source maps, and typings just work.

The Next.js plugin contains executors and generators for managing Next.js applications and libraries within an Nx workspace. It provides:

- Scaffolding for creating, building, serving, linting, and testing Next.js applications.
- Integration with building, serving, and exporting a Next.js application.
- Integration with React libraries within the workspace.

## Setting up Next.js

To create a new Nx workspace with Next.js, run `npx create-nx-workspace@latest --preset=next`.

To add Next.js to an existing Nx workspace, install the `@nrwl/next` package. Make sure to install the version that matches your `@nrwl/workspace` version.

```bash
#yarn
yarn add --dev @nrwl/next
```

```bash
#npm
npm install --save-dev @nrwl/next
```

### Creating Applications

You can add a new application with the following:

```bash
nx g @nrwl/next:app my-new-app
```

### Generating Libraries

Nx allows you to create libraries with just one command. Some reasons you might want to create a library include:

- Share code between applications
- Publish a package to be used outside the monorepo
- Better visualize the architecture using `nx graph`

For more information on Nx libraries, see our documentation on [Creating Libraries](/structure/creating-libraries)
and [Library Types](/structure/library-types).

To generate a new library run:

```bash
nx g @nrwl/next:lib my-new-lib
```

### Generating Pages and Components

Nx also provides commands to quickly generate new pages and components for your application.

```bash
nx g @nrwl/next:page my-new-page --project=my-new-app

nx g @nrwl/next:component my-new-component --project=my-new-app
```

Above commands will add a new page `my-new-page` and a component `my-new-component` to `my-new-app` project respectively.

Nx generates components with tests by default. For pages, you can pass the `--withTests` option to generate tests under the `specs` folder.

## Using Next.js

### Serving Next.js Applications

You can run `nx serve my-new-app` to serve a Next.js application called `my-new-app` for development. This will start the dev server at http://localhost:4200.

To serve a Next.js application for production, add the `--prod` flag to the serve command:

```bash
nx serve my-new-app --prod
```

### Using an Nx Library in your Application

You can import a library called `my-new-lib` in your application as follows.

```typescript jsx
// apps/my-next-app/pages/index.tsx
import { MyNewLib } from '@<your nx workspace name>/my-new-lib';

export function Index() {
  return (
    <MyNewLib>
      <p>The main content</p>
    </MyNewLib>
  );
}

export default Index;
```

There is no need to build the library prior to using it. When you update your library, the Next.js application will automatically pick up the changes.

### Publishable libraries

For libraries intended to be built and published to a registry (e.g. npm) you can use the `--publishable` and `--importPath` options.

```bash
nx g @nrwl/next:lib my-new-lib --publishable --importPath=@happynrwl/ui-components
```

### Testing Projects

You can run unit tests with:

```bash
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` and `my-new-lib` with the name or the project you want to test. This command works for both applications and libraries.

You can also run E2E tests for applications:

```bash
nx e2e my-new-app-e2e
```

Replace `my-new-app-e2e` with the name or your project with -e2e appended.

### Linting Projects

You can lint projects with:

```bash
nx lint my-new-app
nx lint my-new-lib
```

Replace `my-new-app` and `my-new-lib` with the name or the project you want to test. This command works for both applications and libraries.

### Building Projects

Next.js applications can be build with:

```bash
nx build my-new-app
```

And if you generated a library with --buildable, then you can build a library as well:

```bash
nx build my-new-lib
```

After running a build, the output will be in the `dist` folder. You can customize the output folder by setting `outputPath` in the project's `project.json` file.

The library in `dist` is publishable to npm or a private registry.

### Static HTML Export

Next.js applications can be statically exported with:

```bash
nx export my-new-app
```

### Deploying Next.js Applications

Once you are ready to deploy your Next.js application, you have absolute freedom to choose any hosting provider that fits your needs.

You may know that the company behind Next.js, Vercel, has a great hosting platform offering that is developed in tandem with Next.js itself to offer a great overall developer and user experience. We have detailed [how to deploy your Next.js application to Vercel in a separate guide](/guides/deploy-nextjs-to-vercel).

## More Documentation

Here are other resources that you may find useful to learn more about Next.js and Nx.

- **Blog post:** [Building a blog with Next.js and Nx Series](https://blog.nrwl.io/create-a-next-js-web-app-with-nx-bcf2ab54613) by Juri Strumpflohner
- **Video tutorial:** [Typescript NX Monorepo with NextJS and Express](https://www.youtube.com/watch?v=WOfL5q2HznI) by Jack Herrington
