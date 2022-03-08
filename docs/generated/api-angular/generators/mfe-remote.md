---
title: '@nrwl/angular:mfe-remote generator'
description: 'Generate a Remote Angular Micro-Frontend Application.'
---

# @nrwl/angular:mfe-remote

Generate a Remote Angular Micro-Frontend Application.

## Usage

```bash
nx generate mfe-remote ...
```

```bash
nx g remote ... # same
```

By default, Nx will search for `mfe-remote` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:mfe-remote ...
```

Show what will be generated without writing to disk:

```bash
nx g mfe-remote ... --dry-run
```

### Examples

Create an Angular app with configuration in place for MFE. If host is provided, attach this remote app to host app's configuration.:

```bash
nx g @nrwl/angular:mfe-remote appName --host=host --port=4201
```

## Options

### name (_**required**_)

Type: `string`

The name to give to the remote Angular app.

### host

Type: `string`

The name of the host app to attach this remote app to.

### port

Type: `string`

The port on which this app should be served.
