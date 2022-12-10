# The `browserTarget` for Angular projects with a Storybook configuration

{% callout type="note" title="Note" %}
This documentation page contains information about the [Storybook plugin](/packages/storybook), specifically regarding [Angular projects that are using Storybook](/storybook/overview-angular).
{% /callout %}

## Setting up `browserTarget`

If you're using [Storybook](/packages/storybook) in your Angular project, you will notice that `browserTarget` is specified for the `storybook` and `build-storybook` targets, much like it is done for `serve` or other targets. Angular needs the `browserTarget` for Storybook in order to know which configuration to use for the build. If your project is buildable (it has a `build` target, and uses the main Angular builder - `@angular-devkit/build-angular:browser`) the `browserTarget` for Storybook will use the `build` target, if it's not buildable it will use the `build-storybook` target.
You do not have to do anything manually. Nx will create the configuration for you. Even if you are migrating from an older version of Nx, Nx will make sure to change your `package.json` Storybook targets to match the new schema.

You can read more about the `browserTarget` in the [official Angular documentation](https://angular.io/cli/serve).

Your Storybook targets in your `project.json` will look like this:

```jsonc {% fileName="project.json" %}
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
         ...
        "browserTarget": "my-project:build"
      },
      ...
    },
    "build-storybook": {
      "executor": "@storybook/angular:build-storybook",
       ...
      "options": {
         ...
        "browserTarget": "my-project:build"
      },
     ...
    }
```

This setup instructs Nx to use the configuration under the `build` target of `my-project` when using the `storybook` and `build-storybook` executors.

## Setting up `projectBuildConfig` for Nx versions `<14.1.8`

**_Careful: This is for older versions of Nx - for the latest version please look at the section above, about `browserTarget`_**

If you are on Nx version `<14.1.8`, you're still using our custom executor, which means that you have to comply by the Nx Storybook schema. This means that the contents of `browserTarget` should be placed in the `projectBuildConfig` property. This is telling Storybook where to get the build configuration from. To know more about the purpose of `browserTarget` (and `projectBuildConfig`) read the section above.

If you're using Nx version `>=13.4.6` either in a new Nx workspace, or you migrated your older Nx workspace to Nx version `>=13.4.6`, Nx will automatically add the `projectBuildConfig` property in your projects `project.json` files, for projects that are using Storybook.

Your Storybook targets in your `project.json` will look like this:

```jsonc {% fileName="project.json" %}
    "storybook": {
      "executor": "@nrwl/storybook:storybook",
      "options": {
         ...
        "projectBuildConfig": "my-project:build-storybook"
      },
      ...
    },
    "build-storybook": {
      "executor": "@nrwl/storybook:build",
       ...
      "options": {
         ...
        "projectBuildConfig": "my-project:build-storybook"
      },
     ...
    }
```

This setup instructs Nx to use the configuration under the `build-storybook` target of `my-project` when using the `storybook` and `build-storybook` executors.

## Notes about the `defaultProject`

Storybook for Angular needs a default project specified in order to run. The reason is that it uses that default project to read the build configuration from (paths to files to include in the build, and other configurations/settings). In a pure Angular/Storybook setup (**not** an Nx workspace), the Angular application/project would have an `angular.json` file. That file would have a property called `defaultProject`. In an Nx workspace the `defaultProject` property would be specified in the `nx.json` file. Previously, Nx would try to resolve the `defaultProject` of the workspace, and use the build configuration of that project. In most cases, the `defaultProject`'s build configuration would not work for some other project set up with Storybook, since there would most probably be mismatches in paths or other project-specific options.
