# storybook-configuration

Set up storybook for a react library

## Usage

```bash
ng generate storybook-configuration ...
```

By default, Nx will search for `storybook-configuration` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/react:storybook-configuration ...
```

Show what will be generated without writing to disk:

```bash
ng g storybook-configuration ... --dry-run
```

## Options

### configureCypress

Type: `boolean`

Run the cypress-configure schematic

### name

Type: `string`

Library name
