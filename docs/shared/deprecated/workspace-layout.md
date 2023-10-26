# Workspace Layout and projectNameAndRootFormat

As of Nx 16.8.0, generating a project will prompt you to choose how Nx will calculate where the project should be located. You can choose between `as-provided` and `derived`. `as-provided` will be the default in Nx 18.

## `as-provided`

This setting makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/my-lib` folder
- `cd apps/nested/my-app && nx g app my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g app my-app --directory=apps/nested/my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g lib my-lib --directory=libs/shared/ui/my-lib` creates a new library named `my-lib` in the `/libs/shared/ui/my-lib` folder

## `derived`

Choosing `derived` makes Nx behave the way it did before version 16.8.0. Nx will check the `workspaceLayout` property in `nx.json` to determine how it should calculate the path to the new project.

```json
{
  "workspaceLayout": {
    "appsDir": "demos",
    "libsDir": "packages"
  }
}
```

These settings would store apps in `/demos/` and libraries in `/packages/`. The paths specified are relative to the
workspace root.

This makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/demos/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/packages/my-lib` folder
- `nx g app my-app --directory=nested` creates a new application named `nested-my-app` in the `/demos/nested/my-app` folder
- `nx g lib my-lib --directory=shared/ui` creates a new library named `shared-ui-my-lib` in the `/packages/shared/ui/my-lib` folder

If you accidentally generate a project in the wrong folder, use the [move generator](/nx-api/workspace/generators/move) to move it to the correct location.

## Skipping the Prompt

You can skip the prompt in two ways:

1. Specify a flag directly in the terminal `nx g app my-app --directory=apps/my-app --projectNameAndRootFormat=as-provided`
2. Use [Nx Console](/core-features/integrate-with-editors) to run your generators

## More Documentation

- [nameAndDirectoryFormat](/deprecated/name-and-directory-format)
- [Generator Defaults](/reference/nx-json#generators)
