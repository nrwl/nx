# @nrwl/linter:workspace-rule

Create a new workspace ESLint rule

## Usage

```bash
nx generate workspace-rule ...
```

By default, Nx will search for `workspace-rule` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/linter:workspace-rule ...
```

Show what will be generated without writing to disk:

```bash
nx g workspace-rule ... --dry-run
```

### Examples

Create a new workspace lint rule called my-custom-rule:

```bash
nx g @nrwl/linter:workspace-rule my-custom-rule
```

Create a new workspace lint rule located at tools/eslint-rules/a/b/c/my-custom-rule.ts:

```bash
nx g @nrwl/linter:workspace-rule --name=my-custom-rule --directory=a/b/c
```

## Options

### directory (_**required**_)

Alias(es): dir

Default: `rules`

Type: `string`

Create the rule under this directory within tools/eslint-rules/ (can be nested).

### name (_**required**_)

Type: `string`

The name of the new rule
