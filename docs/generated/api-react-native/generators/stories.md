---
title: '@nrwl/react-native:stories generator'
description: 'Create stories for all components declared in an app or library'
---

# @nrwl/react-native:stories

Create stories for all components declared in an app or library

## Usage

```bash
nx generate stories ...
```

By default, Nx will search for `stories` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react-native:stories ...
```

Show what will be generated without writing to disk:

```bash
nx g stories ... --dry-run
```

## Options

### project (_**required**_)

Type: `string`

Library or application name
