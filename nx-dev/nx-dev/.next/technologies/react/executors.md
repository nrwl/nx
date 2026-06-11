
  The @nx/react plugin provides various executors to help you create and configure react projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `module-federation-dev-server`
Serve a web application.

### Examples

###### Basic Usage

The Module Federation Dev Server will serve a host application and find the remote applications associated with the host and serve them statically also.  
See an example set up of it below:

```json
{
  "serve": {
    "executor": "@nx/react:module-federation-dev-server",
    "configurations": {
      "production": {
        "buildTarget": "host:build:production"
      },
      "development": {
        "buildTarget": "host:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "port": 4200,
      "publicHost": "http://localhost:4200"
    }
  }
}
```

###### Serve host with remotes that can be live reloaded

The Module Federation Dev Server will serve a host application and find the remote applications associated with the host and serve a set selection with live reloading enabled also.  
See an example set up of it below:

```json
{
  "serve-with-hmr-remotes": {
    "executor": "@nx/react:module-federation-dev-server",
    "configurations": {
      "production": {
        "buildTarget": "host:build:production"
      },
      "development": {
        "buildTarget": "host:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "port": 4200,
      "publicHost": "http://localhost:4200",
      "devRemotes": [
        "remote1",
        {
          "remoteName": "remote2",
          "configuration": "development"
        }
      ]
    }
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `allowedHosts` | string | This option allows you to whitelist services that are allowed to access the dev server. |  |
| `baseHref` | string | Base url for the application being built. |  |
| `buildTarget` | string | Target which builds the application. |  |
| `devRemotes` | array | List of Producer (remote) applications to run in development mode (i.e. using serve target). |  |
| `hmr` | boolean | Enable hot module replacement. | `false` |
| `host` | string | Host to listen on. | `"localhost"` |
| `isInitialHost` | boolean | Whether the Consumer (host) that is running this executor is the first in the project tree to do so. | `true` |
| `liveReload` | boolean | Whether to reload the page on change, using live-reload. | `true` |
| `maxWorkers` | number | Number of workers to use for type checking. |  |
| `memoryLimit` | number | Memory limit for type checking service process in `MB`. |  |
| `open` | boolean | Open the application in the browser. | `false` |
| `parallel` | number | Max number of parallel processes for building static Producers (remotes) |  |
| `pathToManifestFile` | string | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic Producer (remote) applications relative to the workspace root. |  |
| `port` | number | Port to listen on. | `4200` |
| `publicHost` | string | Public URL where the application will be served. |  |
| `skipRemotes` | array | List of Producer (remote) applications to not automatically serve, either statically or in development mode. This will not remove the Producers (remotes) from the `module-federation.config` file, and therefore the application may still try to fetch these Producers (remotes).
This option is useful if you have other means for serving the Producer (remote) application(s).
**NOTE:** Producers (remotes) that are not in the workspace will be skipped automatically. |  |
| `ssl` | boolean | Serve using `HTTPS`. | `false` |
| `sslCert` | string | SSL certificate to use for serving `HTTPS`. |  |
| `sslKey` | string | SSL key to use for serving `HTTPS`. |  |
| `static` | boolean | Whether to use a static file server instead of the webpack-dev-server. This should be used for Producer (remote) applications that are also Consumer (host) applications. |  |
| `staticRemotesPort` | number | The port at which to serve the file-server for the static Producers (remotes). |  |
| `watch` | boolean | Watches for changes and rebuilds application. | `true` |

### `module-federation-ssr-dev-server`
Serve a SSR Consumer (host) application along with its known Producers (remotes).


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `browserTarget` | string [**required**] | Target which builds the browser application. |  |
| `serverTarget` | string [**required**] | Target which builds the server application. |  |
| `devRemotes` | array | List of Producer (remote) applications to run in development mode (i.e. using serve target). |  |
| `host` | string | Host to listen on. | `"localhost"` |
| `isInitialHost` | boolean | Whether the Consumer (host) that is running this executor is the first in the project tree to do so. | `true` |
| `pathToManifestFile` | string | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic Producer (remote) applications relative to the workspace root. |  |
| `port` | number | The port to be set on `process.env.PORT` for use in the server. | `4200` |
| `skipRemotes` | array | List of Producer (remote) applications to not automatically serve, either statically or in development mode. |  |
| `ssl` | boolean | Serve using HTTPS. | `false` |
| `sslCert` | string | SSL certificate to use for serving HTTPS. |  |
| `sslKey` | string | SSL key to use for serving HTTPS. |  |
| `staticRemotesPort` | number | The port at which to serve the file-server for the static Producers (remotes). |  |

### `module-federation-static-server`
Serve a Consumer (host) application statically along with its Producers (remotes).


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `serveTarget` | string [**required**] |  |  |
