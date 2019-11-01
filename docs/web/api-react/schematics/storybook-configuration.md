# storybook-configuration

Set up storybook for a react library

## Usage

```bash
nx generate storybook-configuration ...
```

By default, Nx will search for `storybook-configuration` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react:storybook-configuration ...
```

Show what will be generated without writing to disk:

```bash
nx g storybook-configuration ... --dry-run
```

## Options

### configureCypress

Type: `boolean`

Run the cypress-configure schematic

### name

Type: `string`

Library name
