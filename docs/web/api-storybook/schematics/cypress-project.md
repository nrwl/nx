# cypress-project

Add cypress e2e app to test a ui library that is set up for storybook

## Usage

```bash
nx generate cypress-project ...
```

By default, Nx will search for `cypress-project` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/storybook:cypress-project ...
```

Show what will be generated without writing to disk:

```bash
nx g cypress-project ... --dry-run
```

## Options

### name

Type: `string`

Library name
