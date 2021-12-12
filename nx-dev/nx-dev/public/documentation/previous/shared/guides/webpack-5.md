# Webpack 5 Migration

Nx 12 is the last version to support Webpack 4. You can enable Webpack 5 in your workspace by following the steps outlined in this document.

In Nx 13, we will only support Webpack 5. Workspaces with custom webpack config need to ensure they have Webpack 5 compatible webpack plugins before Nx 13 is released. If you do not use custom webpack config then the migration should be seamless.

This guide includes instructions and information on how you can update your workspace to Webpack 5.

## Webpack 5 for React Apps

For React apps (i.e. generated with `@nrwl/react:app`) webpack 4 is the default version used by Nx.

To opt into webpack 5 your can run the migration generator from:

```bash
npx nx g @nrwl/web:webpack5
```

## Webpack 5 for Node Apps

For Node apps (i.e. generated with `@nrwl/node:app`) webpack 4 is the default version used by Nx.

To opt into webpack 5 your can run the migration generator from:

```bash
npx nx g @nrwl/node:webpack5
```

**Note:** If you already ran the `@nrwl/web:webpack5` generator, there is no need to also run the `@nrwl/node:webpack` generator. They both install the same packages and are interchangeable.

## Webpack 5 for Next.js Apps

As of Next.js 11 and Nx 12.6.0, webpack 5 is the default version used. If you use a custom webpack setup, you can opt out of webpack 5 by add this to your `next.config.js` file.

```js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNx = require('@nrwl/next/plugins/with-nx');

const nextConfig = {
  webpack5: false,
};

module.exports = withNx(nextConfig);
```

For more information about webpack 5 adoption in Next.js, refer to their [webpack 5 guide](https://nextjs.org/docs/messages/webpack5).

## Webpack 5 for Angular Apps

As of Angular 12, the tooling of Angular uses webpack 5 and support for webpack 4 has been removed.

For more information, refer to their [update guide](https://angular.io/guide/updating-to-version-12).
