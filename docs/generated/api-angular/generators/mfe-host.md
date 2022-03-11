---
title: '@nrwl/angular:mfe-host generator'
description: 'Generate a Host Angular Micro Frontend Application.'
---

# @nrwl/angular:mfe-host

Generate a Host Angular Micro Frontend Application.

## Usage

```bash
nx generate mfe-host ...
```

```bash
nx g host ... # same
```

By default, Nx will search for `mfe-host` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:mfe-host ...
```

Show what will be generated without writing to disk:

```bash
nx g mfe-host ... --dry-run
```

### Examples

Create an Angular app with configuration in place for MFE. If remotes is provided, attach the remote app to this app's configuration.:

```bash
nx g @nrwl/angular:mfe-host appName --remotes=remote1
```

## Options

### name (_**required**_)

Type: `string`

The name to give to the host Angular app.

### host

Type: `string`

The name of the host app to attach this host app to.

### port

Type: `string`

The port on which this app should be served.
