---
title: 'login - CLI command'
description: 'Login to Nx Cloud by generating a personal access token and saving it to your local machine.'
---

# login

Login to Nx Cloud by generating a personal access token and saving it to your local machine.

## Usage

```shell
nx login [nxCloudUrl]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### help

Type: `boolean`

Show help

### nxCloudUrl

Type: `string`

The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to https://cloud.nx.app.

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number
