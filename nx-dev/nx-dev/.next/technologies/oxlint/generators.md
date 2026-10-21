
The @nx/oxlint plugin provides various generators to help you create and configure oxlint projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

For an overview of the plugin and setup instructions, see the [@nx/oxlint introduction](/docs/technologies/oxlint/introduction).

## `configuration`
Register `@nx/oxlint` and enable this project’s Oxlint plugins.

**Usage:**
```bash
nx generate @nx/oxlint:configuration [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project. |  |
| `--keepExistingVersions` | boolean | Keep existing dependency versions when possible. | `false` |
| `--plugins` | array | Oxlint plugins to enable for this project, such as `react` or `jsx-a11y`. | `[]` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/oxlint:<generator> --help
```
