
  The @nx/vite plugin provides various executors to help you create and configure vite projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `build`
Builds a Vite application for production.

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/vite:build",
            //...
            //...
            "options": {
                "outputPath": "dist/apps/my-app"
            },
                //...
            }
        },
    }
}
```

```bash
nx serve my-app
```

### Examples

###### Set a custom path for vite.config.ts

Nx will automatically look in the root of your application for a `vite.config.ts` (or a `vite.config.js`) file. If you want to use a different path, you can set it in your `project.json` file, in the `build` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/vite:build",
            //...
            "options": {
                "outputPath": "dist/apps/my-app",
                "configFile": "apps/my-app/vite.config.other-path.ts"
            },
            "configurations": {
                ...
            }
        },
    }
}
```

or even

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/vite:build",
            //...
            "options": {
                "outputPath": "dist/apps/my-app",
                "configFile": "vite.config.base.ts"
            },
            "configurations": {
                ...
            }
        },
    }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `configFile` | string | The name of the Vite configuration file. |  |
| `generatePackageJson` | boolean | Generate a package.json for the build output. |  |
| `includeDevDependenciesInPackageJson` | boolean | Include devDependencies in the generated package.json. |  |
| `outputPath` | string | The output path of the generated files. |  |
| `skipOverrides` | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `skipPackageManager` | boolean | Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `skipTypeCheck` | boolean | Skip type-checking via TypeScript. Skipping type-checking speeds up the build but type errors are not caught. | `false` |
| `tsConfig` | string | The path to custom tsconfig file for type-checking when skipTypeCheck is false. Required when tsconfig file is not at the projectRoot level. |  |
| `useEnvironmentsApi` | boolean | Use the new Environments API for building multiple environments at once. Only works with Vite 6.0.0 or higher. | `false` |
| `watch` | string | Enable re-building when files change. | `false` |

### `dev-server`
Starts a dev server using Vite.

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
            },
            "configurations": {
                ...
            }
        },
    }
}
```

```bash
nx serve my-app
```

### Examples

###### Set up a custom port

You can always set the port in your `vite.config.ts` file. However, you can also set it directly in your `project.json` file, in the `serve` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "port": 4200,
            },
            "configurations": {
                ...
            }
        },
    }
}
```

###### Specify a proxyConfig

You can specify a proxy config by pointing to the path of your proxy configuration file:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "proxyConfig": "apps/my-app/proxy.conf.json"
            },
            "configurations": {
                ...
            }
        },
    }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | Target which builds the application. Only used to retrieve the configuration as the dev-server does not build the code. |  |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `proxyConfig` | string | Path to the proxy configuration file. |  |

### `preview-server`
Preview Server for Vite.

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "preview": {
            "executor": "@nx/vite:preview-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
            },
            "configurations": {
                ...
            }
        },
    }
}
```

```bash
nx preview my-app
```

### Examples

###### Set up a custom port

You can always set the port in your `vite.config.ts` file. However, you can also set it directly in your `project.json` file, in the `preview` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "preview": {
            "executor": "@nx/vite:preview-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "port": 4200,
            },
            "configurations": {
                ...
            }
        },
    }
}
```

###### Specify a proxyConfig

You can specify a proxy config by pointing to the path of your proxy configuration file:

```json
//...
"my-app": {
    "targets": {
        //...
        "preview": {
            "executor": "@nx/vite:preview-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "proxyConfig": "apps/my-app/proxy.conf.json"
            },
            "configurations": {
                ...
            }
        },
    }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | Target which builds the application. |  |
| `proxyConfig` | string | Path to the proxy configuration file. |  |
| `staticFilePath` | string | Path where the build artifacts are located. If not provided then it will be infered from the buildTarget executor options as outputPath |  |
| `watch` | boolean | Enable re-building when files change. If not specified, watch mode will be enabled by default. | `true` |

### `test`
Test using Vitest.

:::danger[Deprecated]
The `@nx/vite:test` executor is deprecated. Please use `@nx/vitest:test` instead. This executor will be removed in Nx 23.

See the [migration guide](/docs/technologies/test-tools/vitest/guides/migrating-from-nx-vite) for more information.
:::

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "test": {
            "executor": "@nx/vite:test",
            //...
            //...
            "options": {
                "config": "apps/my-app/vite.config.ts"
            }
            //...
        }
    }
}
```

```bash
nx test my-app
```

### Examples

###### Running in watch mode

To run testing in watch mode, you can create a new configuration within your test target, and have watch set to true. For example:

```json
"my-app": {
    "targets": {
        //...
        "test": {
            "executor": "@nx/vite:test",
            //...
            //...
            "options": {
                "config": "apps/my-app/vite.config.ts"
            },
            "configurations": {
                "watch": {
                    "watch": true
                }
            }
        }
    }
}
```

And then run `nx run my-app:test:watch`.

Alternatively, you can just run the default test target with the `--watch` flag preset, like so:

```bash
nx run my-app:test --watch
```

###### Updating snapshots

Whenever a test fails because of an outdated snapshot, you can tell vitest to update them with the following:

```bash
nx run my-app:test -u
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `configFile` | string | The path to the local vitest config, relative to the workspace root. |  |
| `mode` | string | Mode for Vite. |  |
| `reportsDirectory` | string | Directory to write coverage report to. |  |
| `testFiles` | array |  |  |
| `watch` | boolean | Watch files for changes and rerun tests related to changed files. |  |
