---
title: 'Speed up Storybook with Vite and SWC — with the help of Nx'
slug: 'speed-up-storybook-with-vite-and-swc-with-the-help-of-nx'
authors: ['Katerina Skroumpelou']
cover_image: '/blog/images/2022-07-18/1*suutOd685sJtw3uKjMbwhg.png'
tags: [nx, tutorial]
---

## Vite for Storybook in your Nx workspace

[Vite](https://vitejs.dev) is a build tool that ensures faster load times, faster updates, smaller server start times, and more efficient bundling. As described in the [docs](https://vitejs.dev/guide/why.html), it consists of a dev server using ES modules and bundling using Rollup. Starting with Storybook 6.3, [Storybook announced](https://storybook.js.org/blog/storybook-for-vite/) the community-led project for Vite support on Storybook, [Storybook Vite builder](https://github.com/storybookjs/builder-vite). You can also take a look at this [comparison of Storybook performance](https://storybook.js.org/blog/storybook-performance-from-webpack-to-vite/) when using Webpack vs Vite.

You can take advantage of Vite’s speed in Storybook right now. We are going to be following the installation guide of the [Storybook Vite builder](https://github.com/storybookjs/builder-vite#usage), and applying the steps for an Nx Storybook setup.

## How to use Vite for existing Storybook configurations

[Here is a repo with the changes](https://github.com/mandarini/nx-storybook-vite-swc/commit/92f1fb91715c3a89cb2f66cb00a9b297aa7ef2ae).

You can easily add Storybook configuration to your project (application or library) using the [Storybook configuration generator](/nx-api/storybook/generators/configuration) for Nx. This will generate the Storybook configuration files for you, and in the project’s `.storybook/main.js` it will set the `builder` to `webpack5`. If your project is using Angular or React, our generator will also generate Stories for you (`*.stories.*`) based on your components and your components’ inputs/props.

After you have generated your Storybook configuration for your project, you can follow the steps described above to switch to Vite.

If you already have a project in your Nx workspace that has Storybook configured, here are the steps you need to follow to switch to Vite for Storybook:

1.  First, you need to install the required dependencies:

```shell
yarn add -D vite @storybook/builder-vite
```

or

```
npm i -D vite @storybook/builder-vite
```

2\. In your project’s `.storybook/main.js` file (eg.`apps/my-app/.storybook/main.js`) change the `builder` value to `@storybook/builder-vite` .

You also need to set the Vite configuration, to correctly resolve the paths of your workspace.

For that you need to use the `viteFinal` function, as described [here](https://storybook.js.org/docs/react/builders/vite#configuration), and add the `vite-tsconfig-paths` plugin in the `plugins` array of the Vite configuration.

The result will look like this:

```
// apps/my-app/.storybook/main.jsconst rootMain = require(‘../../../.storybook/main’);
**const { mergeConfig } = require('vite');
const viteTsConfigPaths = require('vite-tsconfig-paths').default;**module.exports = { …rootMain, core: { …rootMain.core, **builder: ‘@storybook/builder-vite’** }, stories: [ …rootMain.stories, ‘../src/app/**/*.stories.mdx’, ‘../src/app/**/*.stories.@(js|jsx|ts|tsx)’, ], addons: […rootMain.addons, ‘@nrwl/react/plugins/storybook’], **async viteFinal(config, { configType }) {
      return mergeConfig(config, {
          plugins: [
              viteTsConfigPaths({
                  root: '../../../',
              }),
          ],
      });
  },**};
```

3\. Then, just run Storybook for your project and you will see how it’s now using Vite instead!

```
nx storybook my-app
```

4\. Observe the console for the nice Vite logs

![](/blog/images/2022-07-18/0*_JBUeTagGzg32dzd.avif)

## SWC for Storybook in your Nx workspace

SWC (speedy web compiler) is a compiler written in Rust that can be used for both compilation and bundling.

[Nx supports SWC](/getting-started/intro). Also, the [Next.js compiler](https://nextjs.org/docs/advanced-features/compiler), starting with [version 12](https://nextjs.org/blog/next-12), uses SWC. So, if you’re using SWC in your project, or if you have a Next.js application, then you can use SWC for your Storybook as well.

## How to use SWC for existing Storybook configurations

[Here is a repo with the changes](https://github.com/mandarini/nx-storybook-vite-swc/commit/cc8adc5f2f20ef2ab120902f77906856b37a8cae).

Storybook supports SWC using the `[storybook-addon-swc](https://storybook.js.org/addons/storybook-addon-swc)` addon. If you want to use SWC with Storybook, please read the [documentation](https://storybook.js.org/addons/storybook-addon-swc).

The steps you need to follow to switch to SWC are the following:

1.  Install the addon:

```shell
yarn add -D storybook-addon-swc
```

or

```
npm i -D storybook-addon-swc
```

2\. In your project level `.storybook/main.js`, in the `addons` array, add the `storybook-addon-swc` addon.

## Next.js 12, Storybook, Nx and SWC

[Here is a repo with the changes](https://github.com/mandarini/nx-storybook-vite-swc/commit/59174c2c05018485898ab0b959c1387372a7480d).

If you’re using Next.js, you should also add the `[storybook-addon-next](https://storybook.js.org/addons/storybook-addon-next)`. You can read more in the [documentation](https://storybook.js.org/addons/storybook-addon-next).

Here are the steps you can follow to add this addon:

1.  Install the addon:

```shell
yarn add -D storybook-addon-next
```

or

```
npm i -D storybook-addon-next
```

2\. In your project level `.storybook/main.js`, in the `addons` array, add the `storybook-addon-next` addon like this:

```
const rootMain = require(‘../../../.storybook/main’);
const path = require(‘path’);module.exports = { … addons: [ … ‘storybook-addon-swc’, **{** **name: ‘storybook-addon-next’,** **options: {** **nextConfigPath: path.resolve(__dirname, ‘../next.config.js’),** **},** **},** ], …};
```

## SWC for new Storybook configurations

Nx will generate Storybook configured with SWC **if** you use SWC as a compiler to your build target in your `project.json`, in your project’s configuration, or **if** you use the Next.js `@nrwl/next:build`builder. If you’re generating Storybook configuration for a Next.js application (one that uses `@nrwl/next:build`), then Nx will make sure to add the `storybook-addon-swc` and the `storybook-addon-next` addons to your project’s `.storybook/main.js` or `.storybook/main.ts`.

## Conclusion

Nx offers full support for Vite and SWC with Storybook, and the generators will make sure the transition is seamless and easy. So, go ahead and speed up your Storybook!

We would love for you to try it out and let us know what you think!

Also, make sure you don’t miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools), and
- Subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
- Subscribing to [our newsletter](https://go.nx.dev/nx-newsletter)!
