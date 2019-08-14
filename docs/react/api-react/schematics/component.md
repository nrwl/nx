# component

Create a component

## Usage

```bash
nx generate component ...

```

## Options

### classComponent

Alias(es): C

Default: `false`

Type: `boolean`

Use class components instead of functional component.

### directory

Alias(es): d

Type: `string`

Create the component under this directory (can be nested).

### export

Alias(es): e

Default: `false`

Type: `boolean`

When true, the component is exported from the project index.ts (if it exists).

### name

Type: `string`

The name of the component.

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case component file name (e.g. App.tsx).

### project

Alias(es): p

Type: `string`

The name of the project.

### routing

Type: `boolean`

Generate a library with routes.

### skipTests

Default: `false`

Type: `boolean`

When true, does not create "spec.ts" test files for the new component.

### style

Alias(es): s

Default: `css`

Type: `string`

The file extension to be used for style files.
