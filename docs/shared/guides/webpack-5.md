# Webpack 5 Migration

{% callout type="note" title="Customizing webpack" %}
This page is for Nx 13 migration to Webpack 5, and is no longer applicable in Nx 14+. For customizing Webpack, see [our recipe on this topic](/recipe/customize-webpack).
{% /callout %}

Starting in Nx 13, we only support Webpack 5, which is automatically enabled for all workspaces.

Workspaces with custom webpack configuration should make sure that all their plugins and loaders are compatible with Webpack 5.
For additional help on the migration, check out Webpack's ["To v5 from v4" guide](https://webpack.js.org/migrate/5/).

Nx 12 is the last Nx version to support Webpack 4. We highly suggest you upgrade as soon as possible to benefit from future patches and features.

## Webpack 5 for React Apps

Webpack 5 comes with Nx 13, and your apps should work as long as you use compatible webpack plugins (or don't have customized webpack configuration).

If you have any failing plugins, try upgrading to the latest versions. For more information refer to Webpack's ["To v5 from v4" guide](https://webpack.js.org/migrate/5/).

## Webpack 5 for Next.js Apps

As of Next.js 11 and Nx 12.6.0, Webpack 5 is the default version used. Check your `next.config.js` file to ensure it is
enabled.

```javascript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNx = require('@nrwl/next/plugins/with-nx');

const nextConfig = {
  webpack5: true,
};

module.exports = withNx(nextConfig);
```

For more information about webpack 5 adoption in Next.js, refer to
their [webpack 5 guide](https://nextjs.org/docs/messages/webpack5).

## Webpack 5 for Angular Apps

As of Angular 12, the tooling of Angular uses webpack 5 and support for webpack 4 has been removed.

For more information, refer to their [update guide](https://angular.io/guide/updating-to-version-12).
