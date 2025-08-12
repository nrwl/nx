---
title: Overview of the Nx Next.js Plugin
description: The Nx Next.js plugin contains executors and generators for managing Next.js applications and libraries within an Nx workspace. This page also explains how to configure Next.js on your Nx workspace.
---

# @nx/next

When using Next.js in Nx, you get the out-of-the-box support for TypeScript, Cypress, and Jest. No need to configure anything: watch mode, source maps, and typings just work.

The Next.js plugin contains executors and generators for managing Next.js applications and libraries within an Nx workspace. It provides:

- Scaffolding for creating, building, serving, linting, and testing Next.js applications.
- Integration with building, serving, and exporting a Next.js application.
- Integration with React libraries within the workspace.

## Setting up @nx/next

To create a new Nx workspace with Next.js, run:

```shell
npx create-nx-workspace@latest --preset=next
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/next` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any workspace, you can install `@nx/next` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/next
```

This will install the correct version of `@nx/next`.

{% /tab %}

{% tab label="Nx < 18" %}

Install the `@nx/next` package with your package manager.

```shell
npm add -D @nx/next
```

{% /tab %}
{% /tabs %}

### How @nx/next Infers Tasks

{% callout type="note" title="Inferred Tasks" %}
Since Nx 18, Nx plugins can infer tasks for your projects based on the configuration of different tools. You can read more about it at the [Inferred Tasks concept page](/concepts/inferred-tasks).
{% /callout %}

The `@nx/next` plugin will create tasks for any project that has a Next.js configuration file preset. Any of the following files will be recognized as a Next.js configuration file:

- `next.config.js`
- `next.config.cjs`
- `next.config.mjs`
- `next.config.ts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project <project-name> --web` in your command line.

### @nx/next Configuration

The `@nx/next/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "startTargetName": "start",
        "serveStaticTargetName": "serve-static"
      }
    }
  ]
}
```

- The `buildTargetName` option controls the name of Next.js' compilation task which compiles the application for production deployment. The default name is `build`.
- The `devTargetName` option controls the name of Next.js' development serve task which starts the application in development mode. The default name is `dev`.
- The `startTargetName` option controls the name of Next.js' production serve task which starts the application in production mode. The default name is `start`.
- The `serveStaticTargetName` option controls the name of Next.js' static export task which exports the application to static HTML files. The default name is `serve-static`.

## Using @nx/next

### Creating Applications

You can add a new application with the following:

```shell
nx g @nx/next:app apps/my-new-app
```

### Generating Libraries

Nx allows you to create libraries with just one command. Some reasons you might want to create a library include:

- Share code between applications
- Publish a package to be used outside the monorepo
- Better visualize the architecture using `nx graph`

To generate a new library run:

```shell
nx g @nx/next:lib libs/my-new-lib
```

### Generating Pages and Components

Nx also provides commands to quickly generate new pages and components for your application.

```shell
nx g @nx/next:page apps/my-new-app/pages/my-new-page

nx g @nx/next:component apps/my-new-app/components/my-new-component
```

Above commands will add a new page `my-new-page` and a component `my-new-component` to `my-new-app` project respectively in the specified directories.

Nx generates components with tests by default. For pages, you can pass the `--withTests` option to generate tests under the `specs` folder.

## Using Next.js

### Serving Next.js Applications

{% tabs %}

{% tab label="Using inferred tasks" %}

You can serve a Next.js application `my-new-app` for development:

```shell
nx dev my-new-app
```

To serve a Next.js application for production:

```shell
nx start my-new-app
```

This will start the server at <http://localhost:3000> by default.

{% /tab %}
{% tab label="Using the @nx/next:server executor" %}

You can run `nx serve my-new-app` to serve a Next.js application called `my-new-app` for development. This will start the dev server at <http://localhost:4200>.

To serve a Next.js application for production, add the `--prod` flag to the serve command:

```shell
nx serve my-new-app --prod
```

{% /tab %}
{% /tabs %}

### Using an Nx Library in your Application

You can import a library called `my-new-lib` in your application as follows.

```typescript jsx {% fileName="apps/my-next-app/pages/index.tsx" highlightLines=[1,"5-7"] %}
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

```shell
nx g @nx/next:lib libs/my-new-lib --publishable --importPath=@happynrwl/ui-components
```

### Testing Projects

You can run unit tests with:

```shell
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` and `my-new-lib` with the name or the project you want to test. This command works for both applications and libraries.

You can also run E2E tests for applications:

```shell
nx e2e my-new-app-e2e
```

Replace `my-new-app-e2e` with the name or your project with -e2e appended.

### Linting Projects

You can lint projects with:

```shell
nx lint my-new-app
nx lint my-new-lib
```

Replace `my-new-app` and `my-new-lib` with the name or the project you want to test. This command works for both applications and libraries.

### Building Projects

Next.js applications can be build with:

```shell
nx build my-new-app
```

And if you generated a library with `--bundler`, then you can build a library as well:

```shell
nx build my-new-lib
```

After running a build, the output will be in the `.next` folder inside your app's project directory by default. The output directory can be changed through configuration.

{% tabs %}

{% tab label="@nx/next/plugin and next.config.js" %}

You can customize the output folder path by updating the Next.js config. For example, you can set a custom `distDir` in `next.config.js`:

```javascript {% fileName="apps/my-next-app/next.config.js" highlightLines=[2]%}
const nextConfig = {
  distDir: 'dist',
};

module.exports = nextConfig;
```

Note: This approach works best if you have `@nx/next/plugin` installed in your `nx.json`. You can add it with `nx add @nx/next`.

{% /tab %}

{% tab label="Using the @nx/next:build executor" %}

{% callout type="note" title="Legacy Configuration" %}
This approach is for projects not using the `@nx/next/plugin` in `nx.json`. If you have the plugin configured, it will automatically infer tasks from your Next.js configuration. See the [Inferred Tasks concept page](/concepts/inferred-tasks) for more details.
{% /callout %}

You can customize the output folder by setting `outputPath` in the project's `project.json` file

```json {% fileName="apps/my-next-app/project.json" highlightLines=[9]%}
{
  "root": "apps/my-next-app",
  "sourceRoot": "apps/my-next-app/src",
  "targets": {
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/my-next-app"
      }
    }
  }
}
```

Note that the `sourceRoot` property may not exist for all Next.js applications, as it depends on your project structure.

{% /tab %}
{% /tabs %}

The library in `dist` is publishable to npm or a private registry.

### Static HTML Export

Next.js applications can be statically exported by changing the output inside your Next.js configuration file.

```js {% fileName="apps/my-next-app/next.config.js" highlightLines=[5] %}
const nextConfig = {
  nx: {
    svgr: false,
  },
  output: 'export',
};
```

After setting the output to `export`, you can run the `build` command to generate the static HTML files.

```shell
nx build my-next-app
```

You can then check your project folder for the `out` folder which contains the static HTML files.

```text
├── index.d.ts
├── jest.config.ts
├── next-env.d.ts
├── next.config.js
├── out
├── project.json
├── public
├── specs
├── src
├── tsconfig.json
└── tsconfig.spec.json
```

#### E2E testing

You can perform end-to-end (E2E) testing on static HTML files using a test runner like Cypress. When you create a Next.js application, Nx automatically creates a `serve-static` target. This target is designed to serve the static HTML files produced by the build command.

This feature is particularly useful for testing in continuous integration (CI) pipelines, where resources may be constrained. Unlike the `dev` and `start` targets, `serve-static` does not require a Next.js server to operate, making it more efficient and faster by eliminating background processes, such as file change monitoring.

To utilize the `serve-static` target for testing, run the following command:

```shell
nx serve-static my-next-app-e2e
```

This command performs several actions:

1. It will build the Next.js application and generate the static HTML files.
2. It will serve the static HTML files using a simple HTTP server.
3. It will run the Cypress tests against the served static HTML files.

### Deploying Next.js Applications

Once you are ready to deploy your Next.js application, you have absolute freedom to choose any hosting provider that fits your needs.

You may know that the company behind Next.js, Vercel, has a great hosting platform offering that is developed in tandem with Next.js itself to offer a great overall developer and user experience. We have detailed [how to deploy your Next.js application to Vercel in a separate guide](/technologies/react/recipes/deploy-nextjs-to-vercel).

## More Documentation

Here are other resources that you may find useful to learn more about Next.js and Nx.

- **Blog post:** [Building a blog with Next.js and Nx Series](https://blog.nrwl.io/create-a-next-js-web-app-with-nx-bcf2ab54613) by Juri Strumpflohner
- **Video tutorial:** [Typescript NX Monorepo with NextJS and Express](https://www.youtube.com/watch?v=WOfL5q2HznI) by Jack Herrington
