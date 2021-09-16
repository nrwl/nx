# @nrwl/gatsby:build

Build a Gatsby app

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

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
