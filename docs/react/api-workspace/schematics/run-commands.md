# run-commands

Generates a target to run any command in the terminal

## Usage

```bash
nx generate run-commands ...
```

```bash
nx g run-command ... # same
```

By default, Nx will search for `run-commands` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:run-commands ...
```

Show what will be generated without writing to disk:

```bash
nx g run-commands ... --dry-run
```

### Examples

Add the printhello target to my-feature-lib:

```bash
nx g @nrwl/workspace:run-commands printhello --project my-feature-lib --command 'echo hello'
```

## Options

### command

Type: `string`

Command to run

### cwd

Type: `string`

Current working directory of the command

### name

Type: `string`

Target name

### outputs

Type: `string`

Comma-separated list of output paths

### project

Type: `string`

Project name
