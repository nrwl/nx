# @nrwl/workspace:create-workspace-json

Create a workspace.json file for a workspace that does not have one

## Usage

```bash
nx generate create-workspace-json ...
```

By default, Nx will search for `create-workspace-json` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:create-workspace-json ...
```

Show what will be generated without writing to disk:

```bash
nx g create-workspace-json ... --dry-run
```

## Options

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files
