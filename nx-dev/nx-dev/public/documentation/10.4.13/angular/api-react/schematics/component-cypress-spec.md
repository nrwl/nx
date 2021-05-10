# component-cypress-spec

Create a cypress spec for a ui component that has a story

## Usage

```bash
nx generate component-cypress-spec ...
```

By default, Nx will search for `component-cypress-spec` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react:component-cypress-spec ...
```

Show what will be generated without writing to disk:

```bash
nx g component-cypress-spec ... --dry-run
```

## Options

### componentPath

Type: `string`

Relative path to the component file from the library root?

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### project

Type: `string`

The project name for which to generate tests.
