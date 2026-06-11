
  The @nx/storybook plugin provides various executors to help you create and configure storybook projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `build`
Build storybook in production mode.

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

### Examples

#### For non-Angular projects

###### Working in docsMode

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

#### For Angular projects

###### Default configuration

This is the default configuration for Angular projects using Storybook. You can see that it uses the native `@storybook/angular:build-storybook` executor. You can read more about the configuration options at the relevant [Storybook documentation page](https://storybook.js.org/docs/angular/get-started/install).

```json
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngapp",
    "configDir": "apps/ngapp/.storybook",
    "browserTarget": "ngapp:build",
    "compodoc": false
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
}
```

###### Changing the browserTarget

You can set the `browserTarget` to use `build-storybook` as the builder. This is most useful in the cases where your project does not have a `build` target. Read more about the `browserTarget` in the [Set up Storybook for Angular Projects](/recipes/storybook/overview-angular) recipe.

```json
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngapp",
    "configDir": "apps/ngapp/.storybook",
    "browserTarget": "ngapp:build-storybook",
    "compodoc": false
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
}
```

###### Adding styles

You can add paths to stylesheets to be included in the Storybook build by using the `styles` array. You can also add `stylePreprocessorOptions`, much like you would do in the Angular builder. You can read more in our guide about [styles and preprocessor options for Storybook](/recipes/storybook/angular-configuring-styles).

```json
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngapp",
    "configDir": "apps/ngapp/.storybook",
    "browserTarget": "ngapp:build-storybook",
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
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `configDir` | string [**required**] | Directory where to load Storybook configurations from. |  |
| `debugWebpack` | boolean | Display final webpack configurations for debugging purposes. |  |
| `disableTelemetry` | boolean | Disables Storybook's telemetry. |  |
| `docs` | boolean | Starts Storybook in documentation mode. Learn more about it : https://storybook.js.org/docs/react/writing-docs/build-documentation#preview-storybooks-documentation. |  |
| `docsMode` | boolean | Build a documentation-only site using addon-docs. | `false` |
| `loglevel` | string | Controls level of logging during build. Can be one of: [silly, verbose, info (default), warn, error, silent]. |  |
| `outputDir` | string | Directory where to store built files. |  |
| `quiet` | boolean | Suppress verbose build output. |  |
| `stylePreprocessorOptions` | object | Options to pass to style preprocessors. |  |
| `styles` | array | Global styles to be included in the build. |  |
| `webpackStatsJson` | boolean | string | Write Webpack Stats JSON to disk. | `false` |

### `storybook`
Serve up Storybook in development mode.

`project.json`:

```json
//...
"ui": {
    "targets": {
        //...
        "storybook": {
            "executor": "@nx/storybook:storybook",
            "options": {
                "port": 4400,
                "configDir": "libs/ui/.storybook"
            },
            "configurations": {
                "ci": {
                    "quiet": true
                }
            }
        },
    }
}
```

```bash
nx run ui:storybook
```

### Examples

#### For non-Angular projects

###### Working in docsMode

You can work in docs mode, building a documentation-only site, by setting the `docsMode` option to `true` and using the `@storybook/addon-docs` addon.

Read more on the [Storybook documentation page for `addon-docs`](https://storybook.js.org/addons/@storybook/addon-docs).

```json
"storybook": {
    "executor": "@nx/storybook:storybook",
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

#### For Angular projects

###### Default configuration

This is the default configuration for Angular projects using Storybook. You can see that it uses the native `@storybook/angular:start-storybook` executor. You can read more about the configuration options at the relevant [Storybook documentation page](https://storybook.js.org/docs/angular/get-started/install).

```json
"storybook": {
  "executor": "@storybook/angular:start-storybook",
  "options": {
    "port": 4400,
    "configDir": "libs/ui/.storybook",
    "browserTarget": "ui:build",
    "compodoc": false
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
},
```

###### Changing the browserTarget

You can set the `browserTarget` to use `build-storybook` as the builder. This is most useful in the cases where your project does not have a `build` target. Read more about the `browserTarget` in the [Set up Storybook for Angular Projects](/recipes/storybook/overview-angular) recipe.

```json
"storybook": {
  "executor": "@storybook/angular:start-storybook",
  "options": {
    "port": 4400,
    "configDir": "libs/ui/.storybook",
    "browserTarget": "ui:build-storybook",
    "compodoc": false
  },
  "configurations": {
    "ci": {
      "quiet": true
    }
  }
},
```

###### Adding styles

You can add paths to stylesheets to be included in the Storybook build by using the `styles` array. You can also add `stylePreprocessorOptions`, much like you would do in the Angular builder. You can read more in our guide about [styles and preprocessor options for Storybook](/recipes/storybook/angular-configuring-styles).

```json
"storybook": {
  "executor": "@storybook/angular:start-storybook",
  "options": {
    "port": 4400,
    "configDir": "libs/ui/.storybook",
    "browserTarget": "ui:build",
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
},
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `configDir` | string [**required**] | Directory where to load Storybook configurations from. |  |
| `ci` | boolean | CI mode (skip interactive prompts, don't open browser). | `false` |
| `debugWebpack` | boolean | Display final webpack configurations for debugging purposes. |  |
| `disableTelemetry` | boolean | Disables Storybook's telemetry. |  |
| `docs` | boolean | Starts Storybook in documentation mode. Learn more about it : https://storybook.js.org/docs/react/writing-docs/build-documentation#preview-storybooks-documentation. |  |
| `docsMode` | boolean | Starts Storybook in documentation mode. Learn more about it : https://storybook.js.org/docs/react/writing-docs/build-documentation#preview-storybooks-documentation. | `false` |
| `host` | string | Host to listen on. |  |
| `https` | boolean | Serve Storybook over HTTPS. Note: You must provide your own certificate information. | `false` |
| `loglevel` | string | Controls level of logging during build. Can be one of: [silly, verbose, info (default), warn, error, silent]. |  |
| `noOpen` | boolean | Do not open Storybook automatically in the browser. |  |
| `open` | boolean | Open browser window automatically. |  |
| `port` | number | Port to listen on. | `9009` |
| `previewUrl` | string | Preview URL. |  |
| `quiet` | boolean | Suppress verbose build output. |  |
| `smokeTest` | boolean | Exit after successful start. |  |
| `sslCa` | string | Provide an SSL certificate authority. (Optional with --https, required if using a self-signed certificate). |  |
| `sslCert` | string | Provide an SSL certificate. (Required with --https). |  |
| `sslKey` | string | Provide an SSL key. (Required with --https). |  |
| `uiFramework` | string | Storybook framework npm package. |  |
| `webpackStatsJson` | boolean | string | Write Webpack Stats JSON to disk. | `false` |
