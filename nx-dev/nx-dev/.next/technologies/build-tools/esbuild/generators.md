
The @nx/esbuild plugin provides various generators to help you create and configure esbuild projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Add esbuild configuration to a project.

### Examples

```bash
nx g @nx/esbuild:configuration my-package
```

:::note[Overwriting existing build option]
The `configuration` generator validates that an existing `build` target isn't already defined for the project. If you are adding esbuild to a project with an existing `build` target, pass the `--skipValidation` option.
:::

You may also provide a custom main entry file, or a custom tsconfig file if the defaults don't work. By default, the generator will look for a main file matching `src/index.ts` or `src/main.ts`, and a tsconfig file matching `tsconfig.app.json` or `tsconfig.lib.json`.

```bash
nx g @nx/esbuild:configuration my-package \
--main=packages/my-package/src/entry.ts \
--tsConfig=packages/my-package/tsconfig.custom.json
```

**Usage:**
```bash
nx generate @nx/esbuild:configuration [options]
```

**Aliases:** `esbuild-project`

**Arguments:**
```bash
nx generate @nx/esbuild:configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--buildTarget` | string | The build target to add. | `"build"` |
| `--format` | array | The format to build the library (esm or cjs). | `["esm"]` |
| `--importPath` | string | The library name used to import it, like `@myorg/my-awesome-lib`. |  |
| `--main` | string | Path relative to the workspace root for the main entry file. Defaults to `<project-root>/src/main.ts` or `<project-root>src/index.ts`, whichever is found. |  |
| `--platform` | string | Platform target for outputs. | `"node"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipValidation` | boolean | Do not perform any validation on existing project. | `false` |
| `--tsConfig` | string | Path relative to the workspace root for the tsconfig file to build with. Defaults to `<project-root>/tsconfig.app.json` or `<project-root>/tsconfig.lib.json`, whichever is found. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/esbuild:<generator> --help
```
