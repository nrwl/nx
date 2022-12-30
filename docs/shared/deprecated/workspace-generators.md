# Workspace Generators

In Nx 13.10, we introduced the ability to run generators from Nx plugins in the workspace they were created in.

By using a "local" plugin, you can set the plugin as your workspace's default collection and get several other affordances that are not provided to workspace generators. This is the preferred method for "workspace generators", and existing generators will eventually be transitioned to use a local plugin.

Check the [nx-plugin guide](/packages/nx-plugin) for information on creating a new plugin.

## Converting workspace generators to local generators

- If you don't already have a local plugin, use Nx to generate one:

```shell
# replace `latest` with the version that matches your Nx version
npm install @nrwl/nx-plugin@latest
nx g @nrwl/nx-plugin:plugin my-plugin
```

- Use the Nx CLI to generate the initial files needed for your generator. Replace `my-generator` with the name of your workspace generator.

```shell
nx generate @nrwl/nx-plugin:generator my-generator --project=my-plugin
```

- Copy the code for your workspace generator into the newly created generator's folder. e.g. `libs/my-plugin/src/generators/my-generator/`

- Now you can run the generator like this:

```shell
nx g my-generator
```
