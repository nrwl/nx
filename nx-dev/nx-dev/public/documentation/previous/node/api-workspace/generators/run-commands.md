# @nrwl/workspace:run-commands

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

### command (_**required**_)

Type: `string`

Command to run

### name (_**required**_)

Type: `string`

Target name

### project (_**required**_)

Type: `string`

Project name

### cwd

Type: `string`

Current working directory of the command

### envFile

Type: `string`

Env files to be loaded before executing the commands

### outputs

Type: `string`

Allows you to specify where the build artifacts are stored. This allows Nx Cloud to pick them up correctly, in the case that the build artifacts are placed somewhere other than the top level dist folder.
