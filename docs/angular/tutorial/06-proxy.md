# Angular Nx Tutorial - Step 6: Proxy

<iframe width="560" height="315" src="https://www.youtube.com/embed/7d6jDAbmVnE" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

You passed `--frontendProject=todos` when creating the node application. What did that argument do?

It created a proxy configuration that allows the Angular application to talk to the API in development.

**To see how it works, open `angular.json` and find the `serve` target of the todos app.**

```json
{
  "serve": {
    "builder": "@angular-devkit/build-angular:dev-server",
    "options": {
      "browserTarget": "todos:build",
      "proxyConfig": "apps/todos/proxy.conf.json"
    },
    "configurations": {
      "production": {
        "browserTarget": "todos:build:production"
      }
    }
  }
}
```

**Note the `proxyConfig` property.**

**Now open `proxy.conf.json`:**

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

- Continue to [Step 7: Share Code](/latest/angular/tutorial/07-share-code)
