
The @nx/maven plugin provides various generators to help you create and configure maven projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `ci-workflow`
Setup a CI Workflow to run Nx in CI.

**Usage:**
```bash
nx generate @nx/maven:ci-workflow [options]
```

**Arguments:**
```bash
nx generate @nx/maven:ci-workflow <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--ci` | string [**required**] | CI provider. |  |

## `init`
Initializes @nx/maven in the workspace.

**Usage:**
```bash
nx generate @nx/maven:init [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/maven:<generator> --help
```
