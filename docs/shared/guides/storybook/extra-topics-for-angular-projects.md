# Extra topics for Angular projects

## Configuring `storybook` and `build-storybook` targets

If you are on Nx version `>=14.1.8`, the Nx Storybook plugin for _Angular_ projects uses the original Storybook executors for Angular (`"@storybook/angular:start-storybook"` and `"@storybook/angular:build-storybook"`) to serve and build Storybook. That means that you can use the official [Storybook for Angular documentation (expand the "Troubleshooting" section)](https://storybook.js.org/docs/angular/get-started/install#troubleshooting) to configure the options for serving and building Storybook. Below are two common scenarios that can come up in Storybook for Angular projects.

## The `browserTarget` for Angular

### Setting up `browserTarget`

If you're using Storybook in your Angular project, you will notice that `browserTarget` is specified for the `storybook` and `build-storybook` targets, much like it is done for `serve` or other targets. Angular needs the `browserTarget` for Storybook in order to know which configuration to use for the build. If your project is buildable (it has a `build` target, and uses the main Angular builder - `@angular-devkit/build-angular:browser`) the `browserTarget` for Storybook will use the `build` target, if it's not buildable it will use the `build-storybook` target.
You do not have to do anything manually. Nx will create the configuration for you. Even if you are migrating from an older version of Nx, Nx will make sure to change your `package.json` Storybook targets to match the new schema.

You can read more about the `browserTarget` in the [official Angular documentation](https://angular.io/cli/serve).

Your Storybook targets in your `project.json` will look like this:

```json
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

### Setting up `projectBuildConfig` for Nx versions `<14.1.8`

**_Careful: This is for older versions of Nx - for the latest version please look at the section above, about `browserTarget`_**

If you are on Nx version `<14.1.8`, you're still using our custom executor, which means that you have to comply by the Nx Storybook schema. This means that the contents of `browserTarget` should be placed in the `projectBuildConfig` property. This is telling Storybook where to get the build configuration from. To know more about the purpose of `browserTarget` (and `projectBuildConfig`) read the section above.

If you're using Nx version `>=13.4.6` either in a new Nx workspace, or you migrated your older Nx workspace to Nx version `>=13.4.6`, Nx will automatically add the `projectBuildConfig` property in your projects `project.json` files, for projects that are using Storybook.

Your Storybook targets in your `project.json` will look like this:

```json
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

> **Note:** Storybook for Angular needs a default project specified in order to run. The reason is that it uses that default project to read the build configuration from (paths to files to include in the build, and other configurations/settings). In a pure Angular/Storybook setup (**not** an Nx workspace), the Angular application/project would have an `angular.json` file. That file would have a property called `defaultProject`. In an Nx workspace the `defaultProject` property would be specified in the `nx.json` file. Previously, Nx would try to resolve the `defaultProject` of the workspace, and use the build configuration of that project. In most cases, the `defaultProject`'s build configuration would not work for some other project set up with Storybook, since there would most probably be mismatches in paths or other project-specific options.

## Configuring styles and preprocessor options

Angular supports including extra entry-point files for styles. Also, in case you use Sass, you can add extra base paths that will be checked for imports. In your project's `project.json` file you can use the `styles` and `stylePreprocessorOptions` properties in your `storybook` and `build-storybook` target `options`, as you would in your Storybook or your Angular configurations. If your project is an application, you can add these extra options in your `build` target. Your `storybook` and `build-storybook` `browserTarget` are going to be pointing to the `build` target, so they will pick up these styles from there. Check out the [Angular Workspace Configuration](https://angular.io/guide/workspace-config#styles-and-scripts-configuration) documentation for more information. You can also check the [official Storybook for Angular documentation](https://storybook.js.org/docs/angular/configure/styling-and-css) on working with styles and CSS.

Your Storybook targets in your `project.json` will look like this:

```json
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
         ...
        "styles": ["some-styles.css"],
        "stylePreprocessorOptions": {
          "includePaths": ["some-style-paths"]
        }
      },
      ...
    },
    "build-storybook": {
      "executor": "@storybook/angular:build-storybook",
       ...
      "options": {
         ...
        "styles": ["some-styles.css"],
        "stylePreprocessorOptions": {
          "includePaths": ["some-style-paths"]
        }
      },
     ...
    }
```

> **Note**: Chances are, you will most probably need the same `styles` and `stylePreprocessorOptions` for your `storybook` and your `build-storybook` targets. Since you're using `browserTarget`, that means that Storybook will use the `options` of `build` or `build-storybook` when executing the `storybook` task (when compiling your Storybook). In that case, as explained, you _only_ need to add the `styles` or `stylePreprocessorOptions` to the corresponding target (`build` or `build-storybook`) that the `browserTarget` is pointing to. In that case, for example, the configuration shown above would look like this:

```json
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
         ...
         "browserTarget": "my-project:build-storybook"
      },
      ...
    },
    "build-storybook": {
      "executor": "@storybook/angular:build-storybook",
       ...
      "options": {
         ...
        "browserTarget": "my-project:build-storybook",
        "styles": ["some-styles.css"],
        "stylePreprocessorOptions": {
          "includePaths": ["some-style-paths"]
        }
      },
     ...
    }
```

## Moving your project targets to the new (native Storybook) schema

If you are on Nx version `<14.1.8` and you want to move to the latest version (or any version `>=14.1.8`) you can use the `nx migrate` command, which will take care of migrating your Storybook targets across all your Angular projects using Storybook to use the new schema, the original Storybook executors for Angular. The configuration changes that you need to make will be handled automatically by Nx, so you will not have to do any manual work.

If you have already moved on a version of Nx `>=14.1.8` without using `nx migrate` and now you are having trouble with with your Angular projects using Storybook (eg. `Property 'uiFramework' does not match the schema. '@storybook/angular' should be one of ...`), that means that your targets are still using the old schema and they should change. For that, you can use the [`change-storybook-targets` generator](/packages/storybook/generators/change-storybook-targets) which will take care of changing your `storybook` and `build-storybook` targets across your workspace for your Angular projects using Storybook.
