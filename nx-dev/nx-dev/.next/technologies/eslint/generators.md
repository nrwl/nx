
The @nx/eslint plugin provides various generators to help you create and configure eslint projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `convert-to-flat-config`
Convert an Nx workspace's ESLint configs to use Flat Config.

**Usage:**
```bash
nx generate @nx/eslint:convert-to-flat-config [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--eslintConfigFormat` | string | The format of the generated ESLint flat config files. | `"mjs"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `convert-to-inferred`
Convert existing Eslint project(s) using `@nx/eslint:lint` executor to use `@nx/eslint/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**
```bash
nx generate @nx/eslint:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/eslint:lint` executor to use `@nx/eslint/plugin`. |  |
| `--skipFormat` | boolean | Whether to format files at the end of the migration. | `false` |

## `workspace-rule`
Create a new Workspace Lint Rule.

###### Create rule

This command will generate a new workspace lint rule called `my-custom-rule`. The new rule will be generated in `tools/eslint-rules/rules` folder:

```shell
nx g @nx/eslint:workspace-rule my-custom-rule
```

###### Custom sub-folder

We can change the default sub-folder from `rules` and specify a custom one:

```shell
nx g @nx/eslint:workspace-rule --name=my-custom-rule --directory=my/custom/path
```

The command above will generate the rule in `tools/eslint-rules/my/custom/path` folder.

---

**Usage:**
```bash
nx generate @nx/eslint:workspace-rule [options]
```

**Arguments:**
```bash
nx generate @nx/eslint:workspace-rule <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--directory` | string [**required**] | Create the rule under this directory within `tools/eslint-rules/` (can be nested). | `"rules"` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/eslint:<generator> --help
```
