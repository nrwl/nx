
The @nx/plugin plugin provides various generators to help you create and configure plugin projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `create-package`
Create a framework package that uses Nx CLI.

### Examples

###### Basic executable

Create an executable that initializes an Nx workspace with {my-plugin}'s preset:

```bash
nx g @nx/plugin:create-package create-my-plugin --project my-plugin
```

**Usage:**
```bash
nx generate @nx/plugin:create-package [options]
```

**Arguments:**
```bash
nx generate @nx/plugin:create-package <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--name` | string [**required**] | The package name of cli, e.g. `create-framework-package`. Note this must be a valid NPM name to be published. |  |
| `--project` | string [**required**] | The name of the generator project. |  |
| `--compiler` | string | The compiler used by the build and test targets. | `"tsc"` |
| `--e2eProject` | string | The name of the e2e project. |  |
| `--linter` | string | The tool to use for running lint checks. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. |  |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `e2e-project`
Create an E2E app for a Nx Plugin.

### Examples

###### E2E Project

Scaffolds an E2E project for the plugin `my-plugin`.

```bash
nx g @nx/plugin:e2e-project --pluginName my-plugin --npmPackageName my-plugin --pluginOutputPath dist/my-plugin
```

**Usage:**
```bash
nx generate @nx/plugin:e2e-project [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--npmPackageName` | string [**required**] | the package name of the plugin as it would be published to NPM. |  |
| `--pluginName` | string [**required**] | the project name of the plugin to be tested. |  |
| `--jestConfig` | string | Jest config file. |  |
| `--linter` | string | The tool to use for running lint checks. |  |
| `--minimal` | boolean | Generate the e2e project with a minimal setup. This would involve not generating tests for a default executor and generator. | `false` |
| `--pluginOutputPath` | string | the output path of the plugin after it builds. |  |
| `--projectDirectory` | string | the directory where the plugin is placed. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `executor`
Create an Executor for an Nx Plugin.

### Examples

###### Basic executor

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build.ts
```

###### Without providing the file extension

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build
```

###### With different exported name

Create a new executor called `custom` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build.ts --name=custom
```

###### With custom hashing

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`, that uses a custom hashing function:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build --includeHasher
```

**Usage:**
```bash
nx generate @nx/plugin:executor [options]
```

**Arguments:**
```bash
nx generate @nx/plugin:executor <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--description` | string | Executor description. |  |
| `--includeHasher` | boolean | Should the boilerplate for a custom hasher be generated? | `false` |
| `--name` | string | The executor name to export in the plugin executors collection. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipLintChecks` | boolean | Do not add an eslint configuration for plugin json files. | `false` |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"jest"` |

## `generator`
Create a Generator for an Nx Plugin.

**Usage:**
```bash
nx generate @nx/plugin:generator [options]
```

**Arguments:**
```bash
nx generate @nx/plugin:generator <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--description` | string | Generator description. |  |
| `--name` | string | The generator name to export in the plugin generators collection. |  |
| `--skipFormat` | boolean | Do not format files with prettier. | `false` |
| `--skipLintChecks` | boolean | Do not add an eslint configuration for plugin json files. | `false` |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"jest"` |

## `migration`
Create a Migration for an Nx Plugin.

**Usage:**
```bash
nx generate @nx/plugin:migration [options]
```

**Arguments:**
```bash
nx generate @nx/plugin:migration <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--packageVersion` | string [**required**] | Version to use for the migration. |  |
| `--description` | string | Migration description. |  |
| `--name` | string | The migration name to export in the plugin migrations collection. |  |
| `--packageJsonUpdates` | boolean | Whether or not to include `package.json` updates. | `false` |
| `--skipLintChecks` | boolean | Do not eslint configuration for plugin json files. | `false` |

## `plugin`
Create a Plugin for Nx.

**Usage:**
```bash
nx generate @nx/plugin:plugin [options]
```

**Arguments:**
```bash
nx generate @nx/plugin:plugin <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--compiler` | string | The compiler used by the build and test targets. | `"tsc"` |
| `--e2eProjectDirectory` | string | A directory where the plugin E2E project is placed. |  |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"none"` |
| `--importPath` | string | How the plugin will be published, like `@myorg/my-awesome-plugin`. Note this must be a valid NPM name. |  |
| `--linter` | string | The tool to use for running lint checks. |  |
| `--name` | string | Plugin name |  |
| `--publishable` | boolean | Generates a boilerplate for publishing the plugin to npm. | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipLintChecks` | boolean | Do not eslint configuration for plugin json files. | `false` |
| `--skipTsConfig` | boolean | Do not update tsconfig.json for development experience. | `false` |
| `--standaloneConfig` | boolean | Split the project configuration into `<projectRoot>/project.json` rather than including it inside `workspace.json`. | `true` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. |  |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `plugin-lint-checks`
Adds linting configuration to validate common json files for nx plugins.

**Usage:**
```bash
nx generate @nx/plugin:plugin-lint-checks [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--projectName` | string [**required**] | Which project should be the configuration be added to? |  |
| `--skipFormat` | boolean | Skip formatting files with prettier. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/plugin:<generator> --help
```
