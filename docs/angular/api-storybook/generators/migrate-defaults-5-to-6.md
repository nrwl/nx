# @nrwl/storybook:migrate-defaults-5-to-6

Generate default Storybook configuration files using Storybook version >=6.x specs, for projects that already have Storybook instances and configurations of versions <6.x.

## Usage

```bash
nx generate migrate-defaults-5-to-6 ...
```

By default, Nx will search for `migrate-defaults-5-to-6` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/storybook:migrate-defaults-5-to-6 ...
```

Show what will be generated without writing to disk:

```bash
nx g migrate-defaults-5-to-6 ... --dry-run
```

## Options

### all

Default: `true`

Type: `boolean`

Generate new Storybook configurations for all Storybook instances across all apps and libs.

### keepOld

Default: `true`

Type: `boolean`

Keep the old configuration files - put them in a folder called .old_storybook.

### name

Type: `string`

Leave empty to upgrade all Storybook instances. Only use this if you want to do a gradual migration. Library or application name for which you want to generate the new Storybook configuration.
