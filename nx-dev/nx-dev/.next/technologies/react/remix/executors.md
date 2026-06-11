
  The @nx/remix plugin provides various executors to help you create and configure remix projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `build`
Build a Remix app.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `outputPath` | string [**required**] | The output path of the generated files. |  |
| `generateLockfile` | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match. | `false` |
| `generatePackageJson` | boolean | Generate package.json file in the output folder. | `false` |
| `includeDevDependenciesInPackageJson` | boolean | Include `devDependencies` in the generated package.json file. By default only production `dependencies` are included. | `false` |
| `skipOverrides` | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `skipPackageManager` | boolean | Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `sourcemap` | boolean | Generate source maps for production. | `false` |

### `serve`
Serve a Remix app.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `command` | string | Command used to run your app server. |  |
| `debug` | boolean | Attach a Node.js inspector. | `false` |
| `devServerPort` | number | Port to start the dev server on. |  |
| `manual` | boolean | Enable manual mode | `false` |
| `port` | number | Set PORT environment variable that can be used to serve the Remix application. | `4200` |
| `tlsCert` | string | Path to TLS certificate (cert.pem). |  |
| `tlsKey` | string | Path to TLS key (key.pem). |  |
