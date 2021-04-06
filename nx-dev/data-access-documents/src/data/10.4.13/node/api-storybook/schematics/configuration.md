# configuration

Add storybook configuration to a ui library

## Usage

```bash
nx generate configuration ...
```

By default, Nx will search for `configuration` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/storybook:configuration ...
```

Show what will be generated without writing to disk:

```bash
nx g configuration ... --dry-run
```

## Options

### configureCypress

Type: `boolean`

Run the cypress-configure schematic

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Library name

### uiFramework

Type: `string`

Possible values: `@storybook/angular`, `@storybook/react`

Storybook UI Framework to use
