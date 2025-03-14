---
title: Set Up Application Proxies
description: Learn how to configure proxies for your frontend applications to communicate with backend services during local development, avoiding CORS issues with Webpack, Vite, and Nx executors.
---

# Set Up App Proxies

It is useful to set up frontend proxies to your backend app during local development. By proxying requests, you won't need to set up [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) when communicating with the backend.

## Webpack Dev-Server

Webpack's dev-server has built-in support for [proxies](https://webpack.js.org/configuration/dev-server/#devserverproxy).

For example, if you want to proxy all requests to `/api` to `http://localhost:3000`, then you would use this configuration:

```js {% fileName="webpack.config.js" %}
// ...
module.exports = {
  //...
  devServer: {
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:3000',
      },
    ],
  },
};
```

Say that your frontend app is at port `4200`, then requests to `http://localhost:4200/api` will proxy to the backend app at port `3000`.

If you don't want `/api` to be passed along, then use `pathRewrite`.

```js {% fileName="webpack.config.js" %}
// ...
module.exports = {
  //...
  devServer: {
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:3000',
        pathRewrite: { '^/api': '' },
      },
    ],
  },
};
```

## Vite Server

Vite's server has built-in support for [proxies](https://vitejs.dev/config/server-options#server-proxy).

For example, if you want to proxy all requests to `/api` to `http://localhost:3000`, then you would use this configuration:

```js {% fileName="vite.config.ts" %}
// ...
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

Say that your frontend app is at port `4200`, then requests to `http://localhost:4200/api` will proxy to the backend app at port `3000`.

If you don't want `/api` to be passed along, then use `rewrite`.

```js {% fileName="vite.config.ts" %}
// ...
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

## Automatically Configure Frontend Executors

{% callout type="warning" title="Not recommended for new projects" %}
We recommend configuring proxies using support from existing tooling. Webpack and Vite both come with proxy support out of the box, as do most modern tools. Using `--frontendProject` is meant for Nx prior to version 18.
{% /callout %}

Prior to Nx version 18, projects use [executors](/concepts/executors-and-configurations) to run tasks. If your frontend project is
using executors, then the Node, Nest and Express app generators have an option to configure proxy API requests. This
can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```shell
nx g @nx/node:app apps/<node-app> --frontendProject my-react-app
nx g @nx/nest:app apps/<nest-app> --frontendProject my-react-app
nx g @nx/express:app apps/<express-app> --frontendProject my-react-app
```

This command will generate and configure a `proxy.conf.json` file that will be used by the frontend project's `serve` target to redirect calls to `/api` to instead go to `http://localhost:3000/api`.

```json {% fileName="/apps/my-react-app/proxy.conf.json" %}
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```
