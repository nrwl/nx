
The @nx/rollup plugin provides various generators to help you create and configure rollup projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Add Rollup Configuration to a project.

**Usage:**
```bash
nx generate @nx/rollup:configuration [options]
```

**Aliases:** `rollup-project`

**Arguments:**
```bash
nx generate @nx/rollup:configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--buildTarget` | string | The build target to add. | `"build"` |
| `--compiler` | string | The compiler to use to build source. | `"babel"` |
| `--external` | array | A list of external modules that will not be bundled (`react`, `react-dom`, etc.). |  |
| `--format` | array | The format to build the library (esm or cjs). | `["esm"]` |
| `--importPath` | string | The library name used to import it, like `@myorg/my-awesome-lib`. |  |
| `--main` | string | Path relative to the workspace root for the main entry file. Defaults to '<projectRoot>/src/index.ts'. |  |
| `--rollupConfig` | string | Path relative to workspace root to a custom rollup file that takes a config object and returns an updated config. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipValidation` | boolean | Do not perform any validation on existing project. | `false` |
| `--tsConfig` | string | Path relative to the workspace root for the tsconfig file to build with. Defaults to '<projectRoot>/tsconfig.lib.json'. |  |

## `convert-to-inferred`
Convert existing Rollup project(s) using `@nx/rollup:rollup` executor to use `@nx/rollup/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**
```bash
nx generate @nx/rollup:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/rollup:rollup` executor to use `@nx/rollup/plugin`. |  |
| `--skipFormat` | boolean | Whether to format files at the end of the migration. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/rollup:<generator> --help
```
