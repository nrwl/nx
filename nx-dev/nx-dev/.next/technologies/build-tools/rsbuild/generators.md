
The @nx/rsbuild plugin provides various generators to help you create and configure rsbuild projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Rsbuild configuration generator.

**Usage:**
```bash
nx generate @nx/rsbuild:configuration [options]
```

**Arguments:**
```bash
nx generate @nx/rsbuild:configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--devServerPort` | number | The port for the dev server to listen on. | `4200` |
| `--entry` | string | Path relative to the workspace root for the entry file. Defaults to '<projectRoot>/src/index.ts'. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--target` | string | Target platform for the build, same as the Rsbuild output.target config option. | `"web"` |
| `--tsConfig` | string | Path relative to the workspace root for the tsconfig file to build with. Defaults to '<projectRoot>/tsconfig.app.json'. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/rsbuild:<generator> --help
```
