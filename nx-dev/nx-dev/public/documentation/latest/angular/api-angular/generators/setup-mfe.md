---
title: '@nrwl/angular:setup-mfe generator'
description: 'Generate a Module Federation configuration for a given Angular application.'
---

# @nrwl/angular:setup-mfe

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

### appName (_**required**_)

Type: `string`

The name of the application to generate the Module Federation configuration for.

### mfeType (_**required**_)

Default: `remote`

Type: `string`

Possible values: `host`, `remote`

Type of application to generate the Module Federation configuration for.

### host

Type: `string`

The name of the host application that the remote application will be consumed by.

### port

Type: `number`

The port at which the remote application should be served.

### remotes

Type: `array`

A list of remote application names that the host application should consume.

### routing

Type: `boolean`

Generate a routing setup to allow a host application to route to the remote application.

### skipFormat

Type: `boolean`

Skip formatting the workspace after the generator completes.
