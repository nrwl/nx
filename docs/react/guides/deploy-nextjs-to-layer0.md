# Deploying Next.js applications to Layer0

[Layer0](https://www.layer0.co) is an all-in-one platform to develop, deploy, preview, experiment on, monitor, and run your headless frontend, focused on EdgeJS, predictive prefetching, and performance monitoring.

1. Install Layer0 CLI by the following:
```bash
npm i -g @layer0/cli
0 init
```

2. Create a custom Layer0 connector:

Since our Next.js app isn't located in the root of the project as the @layer0/next connector expects, we'll need to define our own custom connector. To do so:
- Set connector: './layer0' in layer0.config.js
- Copy the [layer0 directory from the example](https://github.com/layer0-docs/layer0-nx-example/tree/master/layer0) into the root of your monorepo.

2. Update routes.js (created by 0 init):
```js
const { Router } = require('@layer0/core/router')
const { default: NextRoutes } = require('@layer0/next/router/NextRoutes')

module.exports = new Router()
  .match('/service-worker.js', ({ serviceWorker }) => {
    return serviceWorker('.next/static/service-worker.js')
  })
  .use(new NextRoutes('apps/next-app')) // provide the path to your Next.js app relative to the root of the monorepo here
```

3. Deploy
```bash
0 deploy
```

Alternatively, you can click the deploy button below to create a new project:

[![Deploy Layer0](https://docs.layer0.co/button.svg)](https://app.layer0.co/deploy?repo=https%3A%2F%2Fgithub.com%2Flayer0-docs%2Flayer0-nx-example&sgId=43cb890e-c460-4450-ae4a-99c440bff375)
