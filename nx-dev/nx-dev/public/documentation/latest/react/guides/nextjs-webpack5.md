# Enable Webpack 5 for Next.js

As of Nx version 12.4.0 - users can opt in to use Webpack 5 for building and serving Next.js applications.

Next.js applications within an Nx workspace are generated with a `next.config.js` file at the root of the application directory. In order to enable Webpack 5, you need to edit `next.config.js` file to add a `future.webpack5` key and set its value to `true`:

```js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNx = require('@nrwl/next/plugins/with-nx');

/**
 * @type {import('@nrwl/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  future: {
    webpack5: true,
  },
};

module.exports = withNx(nextConfig);
```
