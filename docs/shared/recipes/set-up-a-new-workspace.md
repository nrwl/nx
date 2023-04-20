# Set up a New Nx Workspace

Run the following command to create a new workspace.

```shell
# pass @latest in case npx cached an older version of create-nx-workspace
npx create-nx-workspace@latest
```

When creating a workspace, you will have to choose a preset, which will preconfigure a few things for you.

```shell
# create an empty workspace set up for building applications
npx create-nx-workspace --preset=apps

# create an empty workspace set up for building packages
npx create-nx-workspace --preset=core

# create an empty workspace set up for building packages with the @nx/js plugin installed
npx create-nx-workspace --preset=ts
```

Some presets set up applications, e2e tests, etc.

```shell
npx create-nx-workspace --preset=react-standalone
npx create-nx-workspace --preset=react-native
npx create-nx-workspace --preset=angular
```

For more information about possible options see the [create-nx-workspace command](/packages/nx/documents/create-nx-workspace).
