# Step 6: Proxy

You passed `--frontendProject=todos` when creating the node application. What did that argument do?

It created a proxy configuration that allows the Web application to talk to the API in development.

**To see how it works, open `workspace.json` and find the `serve` target of the todos app.**

```json
{
  "serve": {
    "builder": "@nrwl/web:dev-server",
    "options": {
      "buildTarget": "todos:build",
      "proxyConfig": "apps/todos/proxy.conf.json"
    },
    "configurations": {
      "production": {
        "buildTarget": "todos:build:production"
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

This configuration tells `nx serve` to forward all requests starting with `/api` to the process listening on port 3333.

!!!!!
Now run both "nx serve todos" and "nx serve api", open http://localhost:4200. What do you see?
!!!!!
Todos application is working!
404 in the console
Todos are displayed but the Add Todo button doesn't work
