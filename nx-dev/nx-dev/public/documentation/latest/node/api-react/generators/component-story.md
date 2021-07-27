# @nrwl/react:component-story

Generate storybook story for a react component

## Usage

```bash
nx generate component-story ...
```

By default, Nx will search for `component-story` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react:component-story ...
```

Show what will be generated without writing to disk:

```bash
nx g component-story ... --dry-run
```

## Options

### componentPath (_**required**_)

Type: `string`

Relative path to the component file from the library root

### project (_**required**_)

Type: `string`

The project name where to add the components.
