# build

Build a Gatsby app

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/cli-overview#running-tasks.

## Properties

### color

Default: `true`

Type: `boolean`

Enable colored terminal output.

### graphqlTracing

Type: `boolean`

Trace every graphql resolver, may have performance implications.

### openTracingConfigFile

Type: `string`

Tracer configuration file (OpenTracing compatible).

### prefixPaths

Type: `boolean`

Build site with link paths prefixed (set pathPrefix in your config).

### profile

Type: `boolean`

Build site with react profiling.

### uglify

Default: `true`

Type: `boolean`

Build site without uglifying JS bundles (true by default).
