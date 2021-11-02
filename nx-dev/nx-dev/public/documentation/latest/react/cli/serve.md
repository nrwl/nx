# serve

Builds and serves an application, rebuilding on file changes.

## Usage

The `serve` command is a built-in alias to the [run command](/{{framework}}/cli/run).

These two commands are equivalent:

```bash
nx serve <project> [options]
```

```bash
nx run <project>:serve [options]
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Serve the `myapp` project:

```bash
nx serve myapp
```

## Common Options

The options below are common to the `serve` command used within an Nx workspace. The Web and Angular-specific serve options are listed after these options.

### allowedHosts

This option allows you to whitelist services that are allowed to access the dev server.

### hmr

Enable hot module replacement.

### host

Host to listen on.

Default: `localhost`

### liveReload

Whether to reload the page on change, using live-reload.

Default: `true`

### open (-o)

Open the application in the browser.

### port

Port to listen on.

Default: `4200`

### publicHost

Public URL where the application will be served

### ssl

Serve using HTTPS.

### sslKey

SSL key to use for serving HTTPS.

### sslCert

SSL certificate to use for serving HTTPS.

### watch

Watches for changes and rebuilds application

Default: `true`

### help

Show help

### version

Show version number

## Web-Serve Options

### buildTarget

Target which builds the application

### memoryLimit

Memory limit for type checking service process in MB.

### maxWorkers

Number of workers to use for type checking.

## Angular-Serve Options

### aot

Build using Ahead of Time compilation.

### base-href

Base url for the application being built.

### browser-target

Target to serve.

### build-event-log

**EXPERIMENTAL** Output file path for Build Event Protocol events.

### common-chunk

Use a separate bundle containing code used across multiple bundles.

### configuration (-c)

A named build target, as specified in the "configurations" section of the workspace configuration.
Each named target is accompanied by a configuration of option defaults for that target.
Setting this explicitly overrides the `--prod` flag

### deploy-url

URL where files will be deployed.

### disable-host-check

Don't verify connected clients are part of allowed hosts.

### eval-source-map

Output in-file eval sourcemaps.

### hmr-warning

Show a warning when the `--hmr` option is enabled.

### optimization

Enables optimization of the build output.

### poll

Enable and define the file watching poll time period in milliseconds.

### prod

Shorthand for `--configuration=production`.
When true, sets the build configuration to the production target.
By default, the production target is set up in the workspace configuration such that all builds make use of bundling, limited tree-shaking, and also limited dead code elimination.

### progress

Log progress to the console while building.

### proxy-config

Proxy configuration file.

### public-host

The URL that the browser client (or live-reload client, if enabled) should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies.

### serve-path

The pathname where the app will be served.

### serve-path-default-warning

Show a warning when deploy-url/base-href use unsupported serve path values.

### source-map

Output sourcemaps.

### vendor-chunk

Use a separate bundle containing only vendor libraries.

### vendor-source-map

Resolve vendor packages sourcemaps.

### verbose

Adds more details to output logging.
