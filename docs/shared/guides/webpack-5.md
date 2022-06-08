# Webpack 5 Migration

Starting in Nx 13, we only support Webpack 5, which is automatically enabled for all workspaces.

Workspaces with custom webpack configuration should make sure that all their plugins and loaders are compatible with Webpack 5.
For additional help on the migration, check out Webpack's ["To v5 from v4" guide](https://webpack.js.org/migrate/5/).

Nx 12 is the last Nx version to support Webpack 4 so if you cannot upgrade to Webpack 5 then you may stay on this
version, but we highly suggest you upgrade as soon as possible to benefit from future patches and features.

## Nx 12: Testing Webpack 5 Compatibility

If you are still on Nx 12, you can try out Webpack 5 without upgrading fully to Nx 13.

### Webpack 5 for React Apps

For React apps (i.e. generated with `@nrwl/react:app`) webpack 4 is the default version used by Nx.

To opt into webpack 5 your can run the migration generator from:

```bash
npx nx g @nrwl/web:webpack5
```

### Webpack 5 for Node Apps

For Node apps (i.e. generated with `@nrwl/node:app`) webpack 4 is the default version used by Nx.

To opt into webpack 5 your can run the migration generator from:

```bash
npx nx g @nrwl/node:webpack5
```

**Note:** If you already ran the `@nrwl/web:webpack5` generator, there is no need to also run the `@nrwl/node:webpack`
generator. They both install the same packages and are interchangeable.

### Webpack 5 for Next.js Apps

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

### Webpack 5 for Angular Apps

As of Angular 12, the tooling of Angular uses webpack 5 and support for webpack 4 has been removed.

For more information, refer to their [update guide](https://angular.io/guide/updating-to-version-12).
