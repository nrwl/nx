# Configuring styles and preprocessor options for Angular projects with a Storybook configuration

{% callout type="note" title="Note" %}
This documentation page contains information about the [Storybook plugin](/packages/storybook), specifically regarding [Angular projects that are using Storybook](/storybook/overview-angular).
{% /callout %}

Angular supports including extra entry-point files for styles. Also, in case you use Sass, you can add extra base paths that will be checked for imports. In your project's `project.json` file you can use the `styles` and `stylePreprocessorOptions` properties in your `storybook` and `build-storybook` target `options`, as you would in your Storybook or your Angular configurations. If your project is an application, you can add these extra options in your `build` target. Your `storybook` and `build-storybook` `browserTarget` are going to be pointing to the `build` target, so they will pick up these styles from there. Check out the [Angular Workspace Configuration](https://angular.io/guide/workspace-config#styles-and-scripts-configuration) documentation for more information. You can also check the [official Storybook for Angular documentation](https://storybook.js.org/docs/angular/configure/styling-and-css) on working with styles and CSS.

Your Storybook targets in your `project.json` will look like this:

```jsonc {% fileName="project.json" %}
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

## Using build-storybook for styles

Chances are, you will most probably need the same `styles` and `stylePreprocessorOptions` for your `storybook` and your `build-storybook` targets. Since you're using `browserTarget`, that means that Storybook will use the `options` of `build` or `build-storybook` when executing the `storybook` task (when compiling your Storybook). In that case, as explained, you _only_ need to add the `styles` or `stylePreprocessorOptions` to the corresponding target (`build` or `build-storybook`) that the `browserTarget` is pointing to. In that case, for example, the configuration shown above would look like this:

```jsonc {% fileName="project.json" %}
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
