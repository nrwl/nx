# library

Create a nest library

## Usage

```bash
nx generate library ...
```

```bash
nx g lib ... # same
```

By default, Nx will search for `library` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:library ...
```

Show what will be generated without writing to disk:

```bash
nx g library ... --dry-run
```

### Examples

Generate libs/myapp/mylib:

```bash
nx g lib mylib --directory=myapp
```

## Options

### directory

Alias(es): d

Type: `string`

A directory where the library is placed

### name

Type: `string`

Library name

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### tags

Alias(es): t

Type: `string`

Add tags to the library (used for linting)
