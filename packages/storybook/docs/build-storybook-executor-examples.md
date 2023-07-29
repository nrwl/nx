---
title: Storybook builder executor examples
description: This page contains examples for the @nx/storybook:build executor.
---

`project.json`:

```json
//...
"ui": {
    "targets": {
        //...
        "build-storybook": {
            "executor": "@nx/storybook:build",
            "outputs": ["{options.outputDir}"],
            "options": {
                "outputDir": "dist/storybook/ui",
                "configDir": "libs/ui/.storybook"
            },
            "configurations": {
                "ci": {
                    "quiet": true
                }
            }
        }
}
```

```bash
nx run ui:build-storybook
```

## Examples

### For non-Angular projects

{% tabs %}
{% tab label="Working in docsMode" %}

You can work in docs mode, building a documentation-only site, by setting the `docsMode` option to `true` and using the `@storybook/addon-docs` addon.

Read more on the [Storybook documentation page for `addon-docs`](https://storybook.js.org/addons/@storybook/addon-docs).

```json
"storybook": {
    "executor": "@nx/storybook:build",
    "options": {
        "port": 4400,
        "configDir": "libs/ui/.storybook",
        "docsMode": true
    },
    "configurations": {
        "ci": {
            "quiet": true
        }
    }
}
```

{% /tab %}

{% /tabs %}

### For Angular projects

{% tabs %}
{% tab label="Default configuration" %}

This is the default configuration for Angular projects using Storybook. You can see that it uses the native `@storybook/angular:build-storybook` executor. You can read more about the configuration options at the relevant [Storybook documentation page](https://storybook.js.org/docs/angular/get-started/install).

```json
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngapp",
    "configDir": "libs/ui/.storybook",
    "browserTarget": "ui:build",
    "compodoc": false
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
}
```

{% /tab %}
{% tab label="Changing the browserTarget" %}

You can set the [`browserTarget`](/deprecated/storybook/angular-browser-target) to use `build-storybook` as the builder. This is most useful in the cases where your project does not have a `build` target.

```json
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngapp",
    "configDir": "libs/ui/.storybook",
    "browserTarget": "ui:build-storybook",
    "compodoc": false
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
}
```

{% /tab %}

{% tab label="Adding styles" %}

You can add paths to stylesheets to be included in the Storybook build by using the `styles` array. You can also add `stylePreprocessorOptions`, much like you would do in the Angular builder. You can read more in our guide about [styles and preprocessor options for Storybook](/packages/storybook/documents/angular-configuring-styles).

```json
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngapp",
    "configDir": "libs/ui/.storybook",
    "browserTarget": "ui:build-storybook",
    "compodoc": false,
    "styles": ["some-styles.css"],
    "stylePreprocessorOptions": {
        "includePaths": ["some-style-paths"]
 }
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
}
```

{% /tab %}

{% /tabs %}
