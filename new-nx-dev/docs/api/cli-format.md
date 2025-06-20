---
title: nx format
description: 'Check for un-formatted files.'
---

# `nx format`

Check for un-formatted files.

## Aliases

- `format`


## Usage

```bash
nx format:check [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | Format all projects. |  |
| `--base` | string | Base of the current branch (usually main) |  |
| `--files` | string | Change the way Nx is calculating the affected command |  |
| `--head` | string | Latest commit of the current branch (usually HEAD) |  |
| `--libs-and-apps` | boolean | Format only libraries and applications files. |  |
| `--projects` | string | Projects to format (comma/space delimited). |  |
| `--sort-root-tsconfig-paths` | boolean | Ensure the workspace | `true` |
| `--uncommitted` | boolean | Uncommitted changes |  |



