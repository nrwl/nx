
  The @nx/next plugin provides various executors to help you create and configure next projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `build`
Build a Next.js app.

`project.json`:

```json
//...
{
  "name": "acme",
  "$schema": "node_modules/nx/schemas/project-schema.json",
  "sourceRoot": ".",
  "projectType": "application",
  "targets": {
    //...
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      }
    }
    //...
  }
}
```

```bash
nx run acme:build
```

### Examples

#### For Next.js Standalone projects

###### Default configuration

This is the default configuration for Next.js standalone projects. Our `@nx/next:build` executor is integrated to use Next.js' CLI. You can read more about the build options at [Next.js CLI Options](https://nextjs.org/docs/app/api-reference/next-cli)

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": "."
        },
        "production": {}
      }
    },
```

###### Enable debug

You can create a debug build for more verbose output by:

Using the `--debug` flag

```shell
nx run acme:build:development --debug
```

Updating the build options to include `debug`.

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": ".",
          "debug": true
        },
        "production": {}
      }
    },
```

```bash
nx run acme:build:development
```

###### Adding profiling

You can enable profiing for React by

Using the `--profile` flag

```shell
nx run acme:build:production --profile
```

Updating the build options to include `profile`.

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": ".",
        },
        "production": {
          "profile": true
        }
      }
    },
```

```shell
nx run acme:build:production
```

###### Enable experimental app only

Since Next.js 13 the `app/` directory it is reserved.
You can enable to build only `app/` routes by

Using the `--experimentalAppOnly` flag

```shell
nx run acme:build:production --experimentalAppOnly
```

Updating the build options to include `experimentalAppOnly`.

```json
    "build": {
      "executor": "@nx/next:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "outputPath": ".",
          "experimentalAppOnly": true
        },
        "production": {}
      }
    },
```

```shell
nx run acme:build:production
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `outputPath` | string [**required**] | The output path of the generated files. |  |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `debug` | boolean | Enable Next.js debug build logging |  |
| `experimentalAppOnly` | boolean | Only build 'app' routes |  |
| `experimentalBuildMode` | string | Change the build mode. |  |
| `fileReplacements` | array | Replace files with other files in the build. | `[]` |
| `generateLockfile` | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match. | `false` |
| `includeDevDependenciesInPackageJson` | boolean | Include `devDependencies` in the generated package.json file. By default only production `dependencies` are included. | `false` |
| `nextConfig` | string | Path (relative to workspace root) to a function which takes phase, config, and builder options, and returns the resulting config. This is an advanced option and should not be used with a normal Next.js config file (i.e. `next.config.js`). |  |
| `profile` | boolean | Used to enable React Production Profiling |  |
| `skipOverrides` | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `skipPackageManager` | boolean | Do not add a `packageManager` entry to the generated package.json file. |  |
| `turbo` | boolean | Use Turbopack for building (Next.js 15 and below). In Next.js 16+, Turbopack is enabled by default. |  |
| `webpack` | boolean | Use webpack bundler instead of Turbopack (Next.js 16+ only). This flag is only applicable in Next.js 16 and above where Turbopack is the default. |  |

### `server`
Serve a Next.js app.

`project.json`:

```json
//...
{
  "name": "acme",
  "$schema": "node_modules/nx/schemas/project-schema.json",
  "sourceRoot": ".",
  "projectType": "application",
  "targets": {
    //...
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "production",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      }
    }
    //...
  }
}
```

```bash
nx run acme:serve
```

### Examples

#### For Next.js Standalone projects

###### Default configuration

This is the default configuration for Next.js standalone projects. Our `@nx/next:server` executor is integrated to use Next.js' CLI. You can read more about the serve options at [Next.js CLI Options](https://nextjs.org/docs/app/api-reference/next-cli)

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true
        },
        "production": {
          "buildTarget": "acme:build:production",
          "dev": false
        }
      }
    },
```

###### Choosing your bundler

Turbopack is a cutting-edge bundler designed for JavaScript and TypeScript. To read more about supported features see [Next.js Turbopack Documentation](https://turbo.build/pack/docs/features)

**Important: Next.js 16 changed the default bundler**

- **Next.js 15 and below**: Webpack is the default bundler. Use `--turbo` to enable Turbopack.
- **Next.js 16 and above**: Turbopack is the default bundler. Use `--webpack` to use Webpack instead.

#### Using Turbopack in Next.js 15 and below

Append the `--turbo` flag while executing the Nx development server:

```shell
nx run acme:serve --turbo
```

Or update the serve options to include `turbo`:

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true,
          "turbo": true
        }
      }
    }
```

#### Using Webpack in Next.js 16 and above

If you need to use Webpack instead of the default Turbopack in Next.js 16+:

```shell
nx run acme:serve --webpack
```

Or update the serve options to include `webpack`:

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true,
          "webpack": true
        }
      }
    }
```

###### Adding keep alive timeout

When using Nx with Next.js behind a downstream proxy, it's important to make sure that the `keep-alive timeouts` of Next.js' HTTP server are set to longer durations than the timeouts of the proxy. If you don't do this, Node.js will unexpectedly end TCP connections without notifying the proxy when the `keep-alive timeout` is reached. This can lead to a proxy error when the proxy tries to reuse a connection that Node.js has already terminated.

To configure timeout values (in milliseconds) you can:

Pass `--keepAliveTimeout`

```shell
nx run acme:serve --keepAliveTimeout 60000
```

Updating the serve options to include `keepAliveTimeout`.

```json
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build",
        "dev": true
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "dev": true,
          "keepAliveTimeout": 60000
        },
        //
    }
  }
```

```shell
nx run acme:serve
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | Target which builds the application. |  |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `customServerHttps:` | boolean | Enable HTTPS support for the custom server. |  |
| `customServerTarget` | string | Target which builds the custom server. |  |
| `dev` | boolean | Serve the application in the dev mode. | `true` |
| `experimentalHttps` | boolean | Enable HTTPS support for the Next.js development server. |  |
| `experimentalHttpsCa` | string | Path to a HTTPS certificate authority file. |  |
| `experimentalHttpsCert` | string | Path to a HTTPS certificate file. |  |
| `experimentalHttpsKey` | string | Path to a HTTPS key file. |  |
| `hostname` | string | Hostname on which the application is served. |  |
| `keepAliveTimeout` | number | Max milliseconds to wait before closing inactive connection. |  |
| `port` | number | Port to listen on. | `4200` |
| `quiet` | boolean | Hide error messages containing server information. | `false` |
| `staticMarkup` | boolean | Static markup. | `false` |
| `turbo` | boolean | Activate Turbopack for Next.js (Next.js 15 and below). In Next.js 16+, Turbopack is enabled by default for development mode. |  |
| `webpack` | boolean | Use webpack bundler instead of Turbopack (Next.js 16+ only). This flag is only applicable in Next.js 16 and above where Turbopack is the default for development mode. |  |
