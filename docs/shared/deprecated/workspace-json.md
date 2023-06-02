# workspace.json

Nx used to have a `workspace.json` file at the root of the repo that at various points performed these functions:

1. Identified the locations of all project in the repo
2. Contained the target configuration for all projects

Identifying the locations of projects is now done automatically through project inference. You can even customize how projects are inferred with a [project inference plugin](/plugins/recipes/project-inference-plugins).

The target configuration for each project is now stored in individual `project.json` files or `package.json` files.

## Removing workspace.json

To remove `workspace.json` in favor of `project.json` files, run:

```shell
nx g @nx/workspace:fix-configuration
```

See [fix-configuration](/packages/workspace/generators/fix-configuration) for more options.

After this command, `workspace.json` should look like this:

```jsonc
{
  "version": 2,
  "projects": {
    "my-app": "apps/my-app",
    "some-lib": "libs/some-lib"
    // ...
  },
  "$schema": "./node_modules/nx/schemas/workspace-schema.json"
}
```

If every project is listed as a string, instead of an object with project configuration properties, then it is safe to delete the `workspace.json` file.
