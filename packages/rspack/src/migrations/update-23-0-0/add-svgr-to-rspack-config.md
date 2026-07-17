#### Replace the `svgr` Option with the `withSvgr` Composable in Rspack Configs

Updates rspack configs that use React to use a new `withSvgr` composable function instead of passing an `svgr` option to `withReact` or `NxReactRspackPlugin`. The option was removed; SVG handling is now consolidated into the images asset rule by default. The migration inlines a `withSvgr` helper into each affected config so existing SVGR-as-React-component behavior is preserved.

#### Sample Code Changes

Replace the `svgr` option on `withReact` with a `withSvgr(...)` call composed alongside it.

##### Before

```js title="apps/myapp/rspack.config.js" {5}
const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: { svgo: false, titleProp: true, ref: true } })
);
```

##### After

```js title="apps/myapp/rspack.config.js"
const { composePlugins, withNx, withReact } = require('@nx/rspack');

// SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
function withSvgr(svgrOptions = {}) {
  const defaultOptions = { svgo: false, titleProp: true, ref: true };
  const options = { ...defaultOptions, ...svgrOptions };
  return function configure(config) {
    const svgLoaderIdx = config.module.rules.findIndex(
      (rule) =>
        typeof rule === 'object' &&
        typeof rule.test !== 'undefined' &&
        rule.test.toString().includes('svg')
    );
    if (svgLoaderIdx !== -1) {
      config.module.rules.splice(svgLoaderIdx, 1);
    }
    config.module.rules.push(
      { test: /\.svg$/i, type: 'asset', resourceQuery: /url/ },
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        resourceQuery: { not: [/url/] },
        use: [{ loader: '@svgr/webpack', options }],
      }
    );
    return config;
  };
}

module.exports = composePlugins(
  withNx(),
  withReact(),
  withSvgr({ svgo: false, titleProp: true, ref: true })
);
```

For the `NxReactRspackPlugin` style, the `svgr` option is removed from the plugin call and the entire `module.exports` is wrapped with a `withSvgr(...)` call that registers the loader rules directly on the compiler.

##### Before

```js title="apps/myapp/rspack.config.js" {5}
const { NxReactRspackPlugin } = require('@nx/rspack');

module.exports = {
  plugins: [new NxReactRspackPlugin({ svgr: true, main: './src/main.tsx' })],
};
```

##### After

```js title="apps/myapp/rspack.config.js"
const { NxReactRspackPlugin } = require('@nx/rspack');

// SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
function withSvgr(svgrOptions = {}) {
  /* same helper as above, compiler.options.module.rules variant */
}

module.exports = withSvgr()({
  plugins: [new NxReactRspackPlugin({ main: './src/main.tsx' })],
});
```
