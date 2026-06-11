
The @nx/rspack plugin provides various generators to help you create and configure rspack projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Rspack configuration generator.

**Usage:**
```bash
nx generate @nx/rspack:configuration [options]
```

**Arguments:**
```bash
nx generate @nx/rspack:configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--buildTarget` | string | The build target of the project to be transformed to use the @nx/vite:build executor. |  |
| `--devServer` | boolean | Add a serve target to run a local rspack dev-server | `false` |
| `--framework` | string | The framework used by the project. |  |
| `--main` | string | Path relative to the workspace root for the main entry file. Defaults to '<projectRoot>/src/main.ts'. |  |
| `--newProject` | boolean | Is this a new project? | `false` |
| `--rootProject` | boolean |  |  |
| `--serveTarget` | string | The serve target of the project to be transformed to use the @nx/vite:dev-server and @nx/vite:preview-server executors. |  |
| `--style` | string | The style solution to use. |  |
| `--target` | string | Target platform for the build, same as the rspack config option. | `"web"` |
| `--tsConfig` | string | Path relative to the workspace root for the tsconfig file to build with. Defaults to '<projectRoot>/tsconfig.app.json'. |  |

## `convert-config-to-rspack-plugin`
Convert existing Rspack project(s) using `@nx/rspack:rspack` executor that uses `withNx` to use `NxAppRspackPlugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**
```bash
nx generate @nx/rspack:convert-config-to-rspack-plugin [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/rspack:rspack` executor and `withNx` plugin to use `NxAppRspackPlugin`. |  |
| `--skipFormat` | boolean | Whether to format files at the end of the migration. | `false` |

## `convert-to-inferred`
Convert existing Rspack project(s) using `@nx/rspack:rspack` executor to use `@nx/rspack/plugin`.

**Usage:**
```bash
nx generate @nx/rspack:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/rspack:rspack` executor to use `@nx/rspack/plugin`. If not provided, all projects using the `@nx/rspack:rspack` executor will be converted. |  |
| `--skipFormat` | boolean | Whether to format files. | `false` |

## `convert-webpack`
Convert a Webpack project to Rspack.

**Usage:**
```bash
nx generate @nx/rspack:convert-webpack [options]
```

**Aliases:** `convert-to-rspack`

**Arguments:**
```bash
nx generate @nx/rspack:convert-webpack <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/rspack:<generator> --help
```
