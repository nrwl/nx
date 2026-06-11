
The @nx/vitest plugin provides various generators to help you create and configure vitest projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Generate a Vitest setup for a project.

**Usage:**
```bash
nx generate @nx/vitest:configuration [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project to test. |  |
| `--compiler` | string | The compiler to use | `"babel"` |
| `--coverageProvider` | string | Coverage provider to use. | `"v8"` |
| `--inSourceTests` | boolean | Do not generate separate spec files and set up in-source testing. | `false` |
| `--runtimeTsconfigFileName` | string | The name of the project's tsconfig file that includes the runtime source files. If not provided, it will default to `tsconfig.lib.json` for libraries and `tsconfig.app.json` for applications. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipViteConfig` | boolean | Skip generating a vite config file. | `false` |
| `--testEnvironment` | string | The vitest environment to use. See https://vitest.dev/config/#environment. |  |
| `--testTarget` | string | The test target of the project to be transformed to use the @nx/vitest:test executor. |  |
| `--uiFramework` | string | UI framework to use with vitest. |  |
| `--zoneless` | boolean | Whether the Angular project is zoneless. When not provided, it is auto-detected from the project configuration. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/vitest:<generator> --help
```
