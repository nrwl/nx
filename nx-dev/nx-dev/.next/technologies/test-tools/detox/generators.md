
The @nx/detox plugin provides various generators to help you create and configure detox projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `application`
Create Detox Configuration for the workspace.

**Usage:**
```bash
nx generate @nx/detox:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/detox:application <e2eDirectory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appProject` | string [**required**] | Name of the frontend project to be tested. |  |
| `--framework` | string [**required**] | App framework to test |  |
| `--appDisplayName` | string | Display name of the app to be tested if different from appProject |  |
| `--appName` | string | Name of the app to be tested if different from appProject |  |
| `--e2eName` | string | Name of the E2E Project. |  |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `convert-to-inferred`
Convert existing Detox project(s) using `@nx/detox:*` executors to use `@nx/detox/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**
```bash
nx generate @nx/detox:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/detox:*` executors to use `@nx/detox/plugin`. |  |
| `--skipFormat` | boolean | Whether to format files at the end of the migration. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/detox:<generator> --help
```
