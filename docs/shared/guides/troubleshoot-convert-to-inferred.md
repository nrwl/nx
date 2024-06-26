# Troubleshoot Convert to Inferred Migration

Nx comes with plugins that automatically [infer tasks](/concepts/inferred-tasks) (i.e. Project Crystal) for your projects based on the configuration of different tools. Inference plugins come with many benefits, such as reduced boilerplate and access to features such as [task splitting](/ci/features/split-e2e-tasks). To make the transition easier for existing projects that are not yet using inference plugins, many plugins provide the `convert-to-inferred` generator that will switch from executor-based tasks to inferred tasks.

To see a list of the available migration generators, run:

```shell
nx g convert-to-inferred
```

This will prompt you to choose a plugin to run the migration for.

Although the `convert-to-inferred` generator should work for most projects, there are situations that require additional changes to be done by hand. If you run into issues that are not covered on this page, please open an issue on [GitHub](https://github.com/nrwl/nx/issues).

## Error: The nx plugin did not find a project inside...

This error occurs when a configuration file matching the tooling cannot be found. For example, Vite works with `vite.config.ts` (or `.js`, `.cts`, `.mts`, etc.). If you've named your configuration file to something unconventional, you must rename it back to the standard naming convention before running the migration generator again.

For example, if you have a `apps/demo/vite.custom.ts` file and are running `nx g @nx/vite:convert-to-inferred`, you must first rename the file to `apps/demo/vite.config.ts` before running the generator.

## Remix: Unsupported `outputPath` Option

The [`outputPath`](/nx-api/remix/executors/build#outputpath) option from `@nx/remix:build` is ignored because it often leads to ESM errors when the output path is outside the project root. The ESM error occurs because the root `package.json` may not have `"type": "module"` set, which means that the compiled ESM code will fail to run. To guarantee that `serve` works, we migrate the outputs to the Remix defaults (`build` and `public/build` inside the project root). If you have custom directories already defined in your Remix config, it will continue to be used.

To change the outputs after the migration, edit the remix config file, and look for `serverBuildPath` and `assetsBuildDirectory` and set it to the locations you want.

```ts
// ...
export default {
  assetsBuildDirectory: '../../dist/apps/demo/public/build',
  serverBuildPath: '../../dist/apps/demo/build/index.js',
  // ...
};
```

Note that you will need to address potential ESM issues that may arise. For example, change the root `package.json` to `"type": "module"`.

## Remix: Unsupported `generatePackageJson` and `generateLockFile` Options

The `generatePackageJson` and `generateLockFile` options in [`@nx/remix:build`](/nx-api/remix/executors/build) cannot currently be migrated. There is support for this feature in the [Nx Vite plugin](/recipes/vite/configure-vite#typescript-paths), so in the future we may be able to support it if using Remix+Vite.

## Storybook: Conflicting `staticDir` Options

Using `staticDir` for both `@nx/storybook:build-storybook` and `@nx/storybook:storybook` executor options will result in the one from `build-storybook` being used in the resulting `.storybook/main.ts` file. It is not possible for us to support both automatically.

If you need to differentiate `staticDir` between build and serve, then consider putting logic into your `main.ts` file directly.

```ts
// ...
const config: StorybookConfig = {
  // ...
  staticDirs:
    process.env.NODE_ENV === 'production'
      ? ['../static-prod']
      : ['../static-dev'],
};

export default config;
```

## Vite: Unsupported `proxyConfig` Option

Projects that used the [`proxyConfig`](/nx-api/vite/executors/dev-server#proxyconfig) option of `@nx/vite:dev-server` will need to inline the proxy configuration from the original file into `vite.config.ts`.

For example, if you previously used this in `proxy.config.json`:

```json
{
  "/api/*": {
    "target": "http://localhost:3333"
  }
}
```

Then, you will need to add this entry to your `vite.config.ts` file:

```ts
export default defineConfig({
  //...
  server: {
    // ...
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
      },
    },
  },
});
```

## Webpack: Project Cannot Be Migrated

Projects that use [Nx-enhanced Webpack configuration](/recipes/webpack/webpack-config-setup#nxenhanced-configuration-with-composable-plugins) files cannot be migrated to use Webpack CLI. Nx-enhanced configuration files that contain `composePlugins` and `withNx` require the `@nx/webpack:webpack` executor to work.

To solve this issue, run `nx g @nx/webpack:convert-config-to-webpack-plugin` first, and then try again.

## Webpack: Usage of `useLegacyNxPlugin`

When converting from Nx-enhanced to basic Webpack configuration, we add the `useLegacyNxPlugin` utility to ensure that the functionality of your existing configuration continues to function normally. We recommend that you refactor the configuration such that `useLegacyNxPlugin` is not needed.

For example, if you previously added plugins using the configuration function.

```js
// webpack.config.old.js
modules.exports = (config) => {
  config.plugins.push(new SomePlugin());
  return config;
};
```

Then, we recommend that you move the plugin entry to the new configuration file, in the `plugins` option.

```js
module.exports = async () => ({
  devServer: devServerOptions,
  plugins: [new NxAppWebpackPlugin(pluginOptions), new SomePlugin()],
});
```

If you need to apply configuration changes after `NxAppWebpackPlugin` is applied, then you can create a plugin object as follows.

```js
module.exports = async () => ({
  devServer: devServerOptions,
  plugins: [
    new NxAppWebpackPlugin(pluginOptions),
    {
      apply(compiler) {
        const babelLoader = compiler.options.module.rules.find(
          (rule) =>
            rule &&
            typeof rule !== 'string' &&
            rule.loader?.toString().includes('babel-loader')
        );

        // do something with `babelLoader...
      },
    },
  ],
});
```
