# setup-mfe

Generate a Module Federation configuration for a given Angular application.

## Usage

```bash
nx generate setup-mfe ...
```

By default, Nx will search for `setup-mfe` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:setup-mfe ...
```

Show what will be generated without writing to disk:

```bash
nx g setup-mfe ... --dry-run
```

## Options

### appName

Type: `string`

The name of the application to generate the Module Federation configuration for.

### mfeType

Default: `remote`

Type: `string`

Possible values: `shell`, `remote`

Type of application to generate the Module Federation configuration for.

### port

Type: `number`

The port at which the remote application should be served.

### remotes

Type: `array`

A list of remote application names that the shell application should consume.

### skipFormat

Type: `boolean`

Skip formatting the workspace after the generator completes.
