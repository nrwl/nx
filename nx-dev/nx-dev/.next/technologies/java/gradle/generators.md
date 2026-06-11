
The @nx/gradle plugin provides various generators to help you create and configure gradle projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `ci-workflow`
Setup a CI Workflow to run Nx in CI.

**Usage:**
```bash
nx generate @nx/gradle:ci-workflow [options]
```

**Arguments:**
```bash
nx generate @nx/gradle:ci-workflow <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--ci` | string [**required**] | CI provider. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/gradle:<generator> --help
```
