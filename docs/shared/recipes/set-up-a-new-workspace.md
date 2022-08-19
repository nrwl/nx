# Set up a New Nx Workspace

Run the following command to create a new workspace.

```bash
# pass @latest in case npx cached an older version of create-nx-workspace
npx create-nx-workspace@latest
```

When creating a workspace, you will have to choose a preset, which will preconfigure a few things for you.

```bash
# create an empty workspace set up for building applications
npx create-nx-workspace --preset=apps

# create an empty workspace set up for building packages
npx create-nx-workspace --preset=core

# create an empty workspace set up for building packages with the @nrwl/js plugin installed
npx create-nx-workspace --preset=ts
```

Some presets set up applications, e2e tests, etc.

```bash
npx create-nx-workspace --preset=react
npx create-nx-workspace --preset=react-native
npx create-nx-workspace --preset=angular
```

For more information about possible options see the [create-nx-workspace command](/nx/create-nx-workspace).
