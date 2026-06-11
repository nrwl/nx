
The @nx/workspace plugin provides various generators to help you create and configure workspace projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `ci-workflow`
Generate a CI workflow.

**Usage:**
```bash
nx generate @nx/workspace:ci-workflow [options]
```

**Arguments:**
```bash
nx generate @nx/workspace:ci-workflow <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--ci` | string [**required**] | CI provider. |  |
| `--useRunMany` | boolean | Use 'nx run-many' instead of 'nx affected' in the generated CI workflow. | `false` |

## `convert-to-monorepo`
Convert an Nx project to a monorepo.

**Usage:**
```bash
nx generate @nx/workspace:convert-to-monorepo [options]
```

## `fix-configuration`
Migrates v1 config to v2 standalone configuration.

**Usage:**
```bash
nx generate @nx/workspace:fix-configuration [options]
```

**Aliases:** `convert-to-nx-project`

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | Convert all projects |  |
| `--project` | string | Convert a single project |  |
| `--reformat` | boolean | Just reformats the configuration |  |
| `--skipFormat` | boolean | Skip formatting files | `false` |

## `infer-targets`
Convert Nx projects to use inferred targets.

**Usage:**
```bash
nx generate @nx/workspace:infer-targets [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--plugins` | array | The plugins used to infer targets. For example @nx/eslint or @nx/jest |  |
| `--project` | string | The project to convert to use inferred targets. |  |
| `--skipFormat` | boolean | Whether to format files. | `false` |

## `move`
Move a project to another folder in the workspace.

**Usage:**
```bash
nx generate @nx/workspace:move [options]
```

**Aliases:** `mv`

**Arguments:**
```bash
nx generate @nx/workspace:move <destination> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--projectName` | string [**required**] | The name of the project to move. |  |
| `--importPath` | string | The new import path to use in the `tsconfig.base.json`. |  |
| `--newProjectName` | string | The new name of the project after the move. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--updateImportPath` | boolean | Should the generator update the import path to reflect the new location? | `true` |

## `npm-package`
Add a minimal npm package.

**Usage:**
```bash
nx generate @nx/workspace:npm-package [options]
```

**Arguments:**
```bash
nx generate @nx/workspace:npm-package <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--name` | string | Package name. |  |

## `remove`
Remove a project from the workspace.

**Usage:**
```bash
nx generate @nx/workspace:remove [options]
```

**Aliases:** `rm`

**Arguments:**
```bash
nx generate @nx/workspace:remove <projectName> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--forceRemove` | boolean | When `true`, forces removal even if the project is still in use. | `false` |
| `--importPath` | string | The library name used at creation time |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `run-commands`
Create a custom target to run any command.

**Usage:**
```bash
nx generate @nx/workspace:run-commands [options]
```

**Aliases:** `run-command`, `target`

**Arguments:**
```bash
nx generate @nx/workspace:run-commands <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--command` | string [**required**] | Command to run. |  |
| `--project` | string [**required**] | Project name. |  |
| `--cwd` | string | Current working directory of the command. |  |
| `--envFile` | string | Env files to be loaded before executing the commands. |  |
| `--outputs` | string | Allows you to specify where the build artifacts are stored. This allows Nx Cloud to pick them up correctly, in the case that the build artifacts are placed somewhere other than the top level dist folder. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/workspace:<generator> --help
```
