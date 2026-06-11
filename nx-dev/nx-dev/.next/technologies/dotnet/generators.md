
The @nx/dotnet plugin provides various generators to help you create and configure dotnet projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `ci-workflow`
Setup a CI Workflow to run Nx in CI.

**Usage:**
```bash
nx generate @nx/dotnet:ci-workflow [options]
```

**Arguments:**
```bash
nx generate @nx/dotnet:ci-workflow <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--ci` | string [**required**] | CI provider. |  |

## `init`
Initializes a .NET project in the current workspace.

**Usage:**
```bash
nx generate @nx/dotnet:init [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--keepExistingVersions` | boolean | Keep existing dependencies versions | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--updatePackageScripts` | boolean | Update `package.json` scripts with inferred targets | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/dotnet:<generator> --help
```
