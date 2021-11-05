# @nrwl/storybook:composition

Generate Storybook composition setup.

## Usage

```bash
nx generate composition ...
```

By default, Nx will search for `composition` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/storybook:composition ...
```

Show what will be generated without writing to disk:

```bash
nx g composition ... --dry-run
```

## Options

### mainProject (_**required**_)

Type: `string`

The one project that will be used as the main entrypoint for Storybook Composition. This project will run on port 4400 and will not be added as a composition reference. All references will be added to it, instead.

### all

Default: `false`

Type: `boolean`

Compose all Storybook instances.

### projects

Default: ` `

Type: `string`

Projects to add in the composition (comma delimited)

### useExistingPorts

Default: `false`

Type: `boolean`

If false, the Storybook ports in workspace.json/angular.json will be overwritten. If true, the Storybook ports in workspace.json/angular.json will not be overwritten and Storybook Composition will use ordinal numbers to name your instances.
