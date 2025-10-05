---
title: 'login - CLI command'
description: 'Login to Nx Cloud. This command is an alias for [`nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login).'
---

# login

Login to Nx Cloud. This command is an alias for [`nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login).

## Usage

```shell
nx login [nxCloudUrl]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

| Option         | Type    | Description                                                                                                                                                                      |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--help`       | boolean | Show help.                                                                                                                                                                       |
| `--nxCloudUrl` | string  | The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to [https://cloud.nx.app](https://cloud.nx.app). |
| `--verbose`    | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                                           |
| `--version`    | boolean | Show version number.                                                                                                                                                             |
