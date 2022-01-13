# React Nx Tutorial - Step 6: Proxy Configuration

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/xfvCz-yLeEw" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

You passed `--frontendProject=todos` when creating the node application. What did that argument do?

It created a proxy configuration that allows the React application to talk to the API in development.

**To see how it works, open `apps/todos/project.json` and find the `serve` target.**

```json
{
  "serve": {
    "executor": "@nrwl/web:dev-server",
    "options": {
      "buildTarget": "todos:build",
      "hmr": true,
      "proxyConfig": "apps/todos/proxy.conf.json"
    },
    "configurations": {
      "production": {
        "buildTarget": "todos:build:production",
        "hmr": false
      }
    }
  }
}
```

Note the `proxyConfig` property which points to `apps/todos/proxy.conf.json`. Open this file.

```json
{
  "/api": {
    "target": "http://localhost:3333",
    "secure": false
  }
}
```

This configuration tells `npx nx serve` to forward all requests starting with `/api` to the process listening on port `3333`.

## Project.json, Targets, Executors

You configure your apps in `apps/[app-name]/project.json`. Open `apps/todos/project.json` to see an example. This file contains configuration for the todos app. For instance, you can see the `build`, `serve`, `lint`, and `test` targets. This means that you can run `npx nx build todos`, `npx nx serve todos`, etc..

Every target uses an executor which actually runs this target. So targets are analogous to typed npm scripts, and executors are analogous to typed shell scripts.

**Why not use shell scripts and npm scripts directly?**

There are a lot of advantages to providing additional metadata to the build tool. For instance, you can introspect targets. `npx nx serve todos --help` results in:

```bash
npx nx run todos:serve [options,...]

Options:
  --buildTarget           Target which builds the application
  --port                  Port to listen on. (default: 4200)
  --host                  Host to listen on. (default: localhost)
  --ssl                   Serve using HTTPS.
  --sslKey                SSL key to use for serving HTTPS.
  --sslCert               SSL certificate to use for serving HTTPS.
  --watch                 Watches for changes and rebuilds application (default: true)
  --liveReload            Whether to reload the page on change, using live-reload. (default: true)
  --hmr                   Enable hot module replacement.
  --publicHost            Public URL where the application will be served
  --open                  Open the application in the browser.
  --allowedHosts          This option allows you to whitelist services that are allowed to access the dev server.
  --memoryLimit           Memory limit for type checking service process in MB.
  --maxWorkers            Number of workers to use for type checking.
  --help                  Show available options for project target.
```

It helps with good editor integration (see [VSCode Support](/using-nx/console#nx-console-for-vscode)).

But, most importantly, it provides a holistic dev experience regardless of the tools used, and enables advanced build features like distributed computation caching and distributed builds.
