# configuration

Add storybook configuration to a ui library

## Usage

```bash
ng generate configuration ...
```

By default, Nx will search for `configuration` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/storybook:configuration ...
```

Show what will be generated without writing to disk:

```bash
ng g configuration ... --dry-run
```

## Options

### configureCypress

Type: `boolean`

Run the cypress-configure schematic

### name

Type: `string`

Library name

### uiFramework

Type: `string`

Possible values: `@storybook/angular`, `@storybook/react`, `@storybook/web`

Storybook UI Framework to use
