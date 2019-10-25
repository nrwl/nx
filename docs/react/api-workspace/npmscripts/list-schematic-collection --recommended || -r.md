# list [schematic-collection][--recommended || -r]

Lists the installed collections, schematics within an installed collection or recommended collections.

## Usage

```bash
nx list [schematic-collection] [--recommended || -r]
```

Install `@nrwl/cli` globally to invoke the command directly using `nx`, or use `npm run nx` or `yarn nx`.

### Examples

List the collections installed in the current workspace:

```bash
nx list
```

List the schematics available in the `@nrwl/web` collection:

```bash
nx list @nrwl/web
```

List the recommended schematic collections available to install:

```bash
nx list --recommended
```

## Options

### help

Show help

### recommended

Default: `false`

Analyse the current workspace to recomend collections to install

### schematic-collection

Default: `null`

The name of an installed schematic collection to query

### version

Show version number
