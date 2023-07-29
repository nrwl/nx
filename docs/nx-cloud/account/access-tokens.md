# Nx CLI and Access Tokens

The permissions and membership define what developers can access on nx.app. They don't affect what happens when you run Nx commands locally or on CI. To manage that, you need to provision access tokens. To do that, go to Workspace Options / Manage Access Tokens.

## Types of Access Tokens

There are currently two (2) types of Access Tokens for Nx Cloud's runner that you can use on your workspace. Both tokens support distributed task execution and allow Nx Cloud to store metadata about runs.

- `read-only`
- `read-write`

### Access Tokens: Read Only

The `read-only` access tokens will only read from the remote cache. Task results will not be stored in the remote cache for other developers to use.

### Access Tokens: Read & Write

The `read-write` access tokens allows task results to be stored in the remote cache for other developers to download and replay on their machines.

## Setting Access Tokens

Let's see how access tokens work.

If you open your `nx.json`, you will see something like this:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
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

## Using `nx-cloud.env`

You can set locally an environment variable via the `nx-cloud.env` file. Nx Cloud CLI will be looking into this file to load custom configuration like `NX_CLOUD_ACCESS_TOKEN`. These environment variables will take precedence over the configuration in `nx.json`.
