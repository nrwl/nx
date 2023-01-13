# Migration Generators

When your plugin is being used in other repos, it is helpful to provide migration generators to automatically update configuration files when your plugin makes a breaking change.

A migration generator is a normal generator that is triggered when a developer runs the `nx migrate` command.

## Create a Migration Generator

For this example, we'll create a new migration generator that updates repos to use `newExecutorName` instead of `oldExecutorName` in their targets. This migration will be applied when the run `nx migrate` to move up past version `2.0.1` of our plugin.

### 1. Generate a migration

```shell
nx generate @nrwl/nx-plugin:migration 'Change Executor Name' --packageVersion=2.0.1 --project=pluginName --description='Changes the executor name from oldExecutorName to newExecutorName'
```

This command will update the following files:

```json {% fileName="package.json" %}
{
  "nx-migrations": {
    "migrations": "./migrations.json"
  }
}
```

```json {% fileName="migrations.json" %}
{
  "generators": {
    "change-executor-name": {
      "version": "2.0.1",
      "description": "Changes the executor name from oldExecutorName to newExecutorName",
      "cli": "nx",
      "implementation": "./src/migrations/change-executor-name/change-executor-name"
    }
  }
}
```

And it creates a blank generator under: `libs/pluginName/src/migrations/change-executor-name/change-executor-name.ts`

### 2. Write the Generator Code

```ts {% fileName="change-executor-name.ts" %}
import { getProjects, Tree, updateProjectConfiguration } from '@nrwl/devkit';

export function changeExecutorNameToNewName(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, project] of projects) {
    if (
      project.targets?.build?.executor === '@myorg/pluginName:oldExecutorName'
    ) {
      project.targets.build.executor = '@myorg/pluginName:newExecutorName';
      updateProjectConfiguration(tree, name, project);
    }
  }
}

export default changeExecutorNameToNewName;
```

## Update package.json dependencies

If you just need to change dependency versions, you can add some configuration options to the `migrations.json` file without making a full generator.

```json {% fileName="migrations.json" %}
{
  "packageJsonUpdates": {
    "12.10.0": {
      "version": "12.10.0-beta.2",
      "packages": {
        "@testing-library/react": {
          "version": "11.2.6",
          "alwaysAddToPackageJson": false
        }
      }
    }
  }
}
```
