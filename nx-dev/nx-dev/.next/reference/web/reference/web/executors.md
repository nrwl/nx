
  The @nx/web plugin provides various executors to help you create and configure web projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `file-server`
Serve a web application from a folder. This executor is a wrapper around the [http-server](https://www.npmjs.com/package/http-server) package.

`project.json`:

```json5
"myapp": {
  "targets": {
    "serve": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "build",
        "port": 3000,
      },
    },
    "build": {
      "outputs": ["{workspaceRoot}/dist/myapp"],
      "command": "echo 'Generating index.html' && mkdir -p dist && echo '<h1>Works</h1>' > dist/myapp/index.html"
    },
  }
}
```

```shell
nx serve myapp
```

### Examples

###### Additional http-server options

There are additional options from `http-server` that can be passed as CLI args. For example, to enable directory listing, pass `-d` as follows:

```shell
nx serve myapp -d
```

Refer to the [`http-server`](https://www.npmjs.com/package/http-server) package for all available options.
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `brotli` | boolean | Enable brotli compression | `false` |
| `buildTarget` | string | Target which builds the application. |  |
| `cacheSeconds` | number | Set cache time (in seconds) for cache-control max-age header. To disable caching, use -1. Caching defaults to disabled. | `-1` |
| `cors` | string | Enable CORS | `true` |
| `gzip` | boolean | Enable gzip compression | `false` |
| `host` | string | Host to listen on. | `"localhost"` |
| `maxParallel` | number | Max number of parallel jobs. |  |
| `parallel` | boolean | Build the target in parallel. | `true` |
| `port` | number | Port to listen on. | `4200` |
| `proxyOptions` | object | Options for the proxy used by `http-server`. | `{}` |
| `proxyUrl` | string | URL to proxy unhandled requests to. _Note: If the 'spa' flag is set to true, manually setting this value will override the catch-all redirect functionality from http-server which may lead to unexpected behavior._ |  |
| `spa` | boolean | Redirect 404 errors to index.html (useful for SPA's) | `false` |
| `ssl` | boolean | Serve using `HTTPS`. | `false` |
| `sslCert` | string | SSL certificate to use for serving `HTTPS`. |  |
| `sslKey` | string | SSL key to use for serving `HTTPS`. |  |
| `staticFilePath` | string | Path where the build artifacts are located. If not provided then it will be infered from the buildTarget executor options as outputPath |  |
| `watch` | boolean | Watch for file changes. | `true` |
