# Workspace Executors

In Nx 13.10+, local nx plugins can contain executors that are used in the workspace. When creating a custom executor for your workspace, look into the [local executor guide](/plugins/recipes/local-executors) to simplify the build process.

## Converting workspace executors to local executors

- If you don't already have a local plugin, use Nx to generate one:

```shell
# replace `latest` with the version that matches your Nx version
npm install @nx/plugin@latest
nx g @nx/plugin:plugin my-plugin
```

- Use the Nx CLI to generate the initial files needed for your executor. Replace `my-executor` with the name of your workspace executor.

```shell
nx generate @nx/plugin:executor my-executor --project=my-plugin
```

- Copy the code for your workspace executor into the newly created executor's folder. e.g. `libs/my-plugin/src/executors/my-executor/`

- Now you can reference the executor like this:

```jsonc
{
  "executor": "@my-org/my-plugin:my-executor"
}
```
