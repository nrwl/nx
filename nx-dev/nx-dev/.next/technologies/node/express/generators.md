
The @nx/express plugin provides various generators to help you create and configure express projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

For an overview of the plugin and setup instructions, see the [@nx/express introduction](/docs/technologies/node/express/introduction).

## `application`
Nx Application Options Schema.

**Usage:**
```bash
nx generate @nx/express:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/express:application <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--babelJest` | boolean | Use `babel` instead `ts-jest`. | `false` |
| `--enableTypedLinting` | boolean | Whether to enable typed linting. For flat configs, this configures the recommended `parserOptions.projectService` and `tsconfigRootDir`. For legacy `.eslintrc` configs, this configures `parserOptions.project`. We do not enable this by default for lint performance reasons. | `false` |
| `--frontendProject` | string | Frontend project that needs to access this application. This sets up proxy configuration. |  |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--keepExistingVersions` | boolean | Keep existing dependencies versions | `true` |
| `--linter` | string | The tool to use for running lint checks. Defaults to the linter the workspace already uses. |  |
| `--name` | string | The name of the application. |  |
| `--setParserOptionsProject` | boolean | Deprecated alias for `enableTypedLinting`. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--swcJest` | boolean | Use `@swc/jest` instead `ts-jest` for faster test compilation. | `false` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/express:<generator> --help
```
