---
title: 'repair - CLI command'
description: 'Repair any configuration that is no longer supported by Nx.

  Specifically, this will run every migration within the `nx` package
  against the current repository. Doing so should fix any configuration
  details left behind if the repository was previously updated to a new
  Nx version without using `nx migrate`.

  If your repository has only ever updated to newer versions of Nx with
  `nx migrate`, running `nx repair` should do nothing.
  '
---

# repair

Repair any configuration that is no longer supported by Nx.

    Specifically, this will run every migration within the `nx` package
    against the current repository. Doing so should fix any configuration
    details left behind if the repository was previously updated to a new
    Nx version without using `nx migrate`.

    If your repository has only ever updated to newer versions of Nx with
    `nx migrate`, running `nx repair` should do nothing.

## Usage

```shell
nx repair
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

| Option      | Type    | Description                                                            |
| ----------- | ------- | ---------------------------------------------------------------------- |
| `--help`    | boolean | Show help.                                                             |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |
| `--version` | boolean | Show version number.                                                   |
