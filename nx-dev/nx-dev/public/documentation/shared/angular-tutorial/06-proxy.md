# Angular Nx Tutorial - Step 6: Proxy

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/7d6jDAbmVnE" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

You passed `--frontendProject=todos` when creating the node application. What did that argument do?

It created a proxy configuration that allows the Angular application to talk to the API in development.

**To see how it works, open `apps/todos/project.json` and find the `serve` target of the todos app.**

```json
{
  "serve": {
    "executor": "@angular-devkit/build-angular:dev-server",
    "configurations": {
      "production": {
        "browserTarget": "todos:build:production"
      },
      "development": {
        "browserTarget": "todos:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "proxyConfig": "apps/todos/proxy.conf.json"
    }
  }
}
```

**Note the `proxyConfig` property.**

**Now open `apps/todos/proxy.conf.json`:**

```json
{
  "/api": {
    "target": "http://localhost:3333",
    "secure": false
  }
}
```

This configuration tells `nx serve` to forward all requests starting with `/api` to the process listening on port `3333`.

## What's Next

- Continue to [Step 7: Share Code](/angular-tutorial/07-share-code)
