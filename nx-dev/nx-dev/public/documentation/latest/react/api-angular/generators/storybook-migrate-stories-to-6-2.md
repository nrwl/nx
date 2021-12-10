---
title: '@nrwl/angular:storybook-migrate-stories-to-6-2 generator'
description: 'Migrates stories to match the new syntax in v6.2 where the component declaration should be in the default export.'
---

# @nrwl/angular:storybook-migrate-stories-to-6-2

Migrates stories to match the new syntax in v6.2 where the component declaration should be in the default export.

## Usage

```bash
nx generate storybook-migrate-stories-to-6-2 ...
```

By default, Nx will search for `storybook-migrate-stories-to-6-2` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:storybook-migrate-stories-to-6-2 ...
```

Show what will be generated without writing to disk:

```bash
nx g storybook-migrate-stories-to-6-2 ... --dry-run
```
