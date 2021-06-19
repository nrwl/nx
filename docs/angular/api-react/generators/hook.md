# hook

Create a hook

## Usage

```bash
nx generate hook ...
```

```bash
nx g h ... # same
```

By default, Nx will search for `hook` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react:hook ...
```

Show what will be generated without writing to disk:

```bash
nx g hook ... --dry-run
```

### Examples

Generate a hook in the mylib library:

```bash
nx g hook my-hook --project=mylib
```

## Options

### directory

Alias(es): d

Type: `string`

Create the component under this directory (can be nested).

### export

Alias(es): e

Default: `false`

Type: `boolean`

When true, the component is exported from the project index.ts (if it exists).

### flat

Default: `false`

Type: `boolean`

Create component at the source root rather than its own directory.

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### name

Type: `string`

The name of the component.

### pascalCaseDirs

Alias(es): R

Default: `false`

Type: `boolean`

Use pascal case component directory name (e.g. useThing/useThing.ts).

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case hook file name (e.g. useHook.ts).

### project

Alias(es): p

Type: `string`

The name of the project.

### skipTests

Default: `false`

Type: `boolean`

When true, does not create "spec.ts" test files for the new hook.
