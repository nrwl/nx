# Nx CLI and Access Tokens

The permissions and membership define what developers can access on nx.app. They don't affect what happens when you run Nx commands locally or on CI. To manage that, you need to provision access tokens. To do that, go to Workspace Options / Manage Access Tokens.

There are two types of tokens:

Read - stores metadata about runs and reads cached artifacts, supports distributed task execution.

Read-write - stores metadata about runs, reads and writes cached artifacts, supports distributed task execution.

## Setting Access Tokens

Let's see how access tokens work.

If you open your `nx.json`, you will see something like this:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "accessToken": "SOMETOKEN",
        "cacheableOperations": ["build", "test", "lint", "e2e"]
      }
    }
  }
}
```

If you remove the `accessToken` property from the configuration, the runner will run all commands as if you were not connected to Nx Cloud. This essentially turns off Nx Cloud.

## Setting a Different Access Token in CI

You can also configure the access token by setting the `NX_CLOUD_ACCESS_TOKEN` environment variable. `NX_CLOUD_ACCESS_TOKEN` takes precedence over the `accessToken` property. It's common to have a read-only token stored in `nx.json` and a read-write token set via `NX_CLOUD_ACCESS_TOKEN` in CI.
