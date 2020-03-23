# generate

Runs a schematic that generates and/or modifies files based on a schematic from a collection.

## Usage

```bash
nx generate <collection:schematic>
```

```bash
nx g <schematic>
```

Install `@nrwl/cli` globally to invoke the command directly using `nx`, or use `npm run nx` or `yarn nx`.

> When used within an Nx workspace with the Angular CLI as the primary CLI, the Nx CLI delegates the `generate` command to the Angular CLI's `generate` command.

### Examples

Generate a new Angular application:

```bash
nx generate @nrwl/node:app myapp
```

Generate a new React application:

```bash
nx generate @nrwl/react:app myapp
```

Generate a new Node application:

```bash
nx generate @nrwl/node:app myapp
```

## Options

### defaults

Default: `false`

When true, disables interactive input prompts for options with a default.

### dryRun

Default: `false`

When true, disables interactive input prompts for options with a default.

### force

Default: `false`

When true, forces overwriting of existing files.

### interactive

Default: `true`

When false, disables interactive input prompts.

### help

Show help and display available schematics in the default collection.

### version

Show version number
