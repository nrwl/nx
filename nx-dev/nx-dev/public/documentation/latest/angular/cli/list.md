# list

Lists installed plugins, capabilities of installed plugins and other available plugins.

## Usage

```bash
nx list
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

List the plugins installed in the current workspace:

```bash
nx list
```

List the generators and executors available in the `@nrwl/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace):

```bash
nx list @nrwl/web
```

## Options

### help

Show help

### plugin

Default: `null`

The name of an installed plugin to query

### version

Show version number
