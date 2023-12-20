# ESLint Inferred Targets

In Nx version 17.3, the `@nx/eslint` plugin can create [inferred targets](/concepts/inferred-targets) for projects that have an ESLint configuration file present. This means you can run `nx lint my-project` for that project, even if there is no `lint` target defined in `package.json` or `project.json`.

## Setup

To enable inferred targets, add `@nx/eslint/plugin` to the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```

## Target Inference Process

### Identify Valid Projects

The `@nx/eslint` plugin will create a target for any project that has an ESLint configuration file present. Any of the following files will be recognized as an ESLint configuration file:

- `.eslintrc`
- `.eslintrc.js`
- `.eslintrc.cjs`
- `.eslintrc.yaml`
- `.eslintrc.yml`
- `.eslintrc.json`
- `eslint.config.js`

### Name the Inferred Target

Once an ESLint configuration file has been identified, the target is created with the name you specify under `targetName` in the `nx.json` `plugins` array. The default name for inferred targets is `lint`.

### Set Inferred Options

The `@nx/eslint` plugin will start with any `targetDefaults` you have set in `nx.json`, and then apply the following properties:

| Property  | Sample Value                                     | Description                                                                                                                         |
| --------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `command` | `eslint .`                                       | Run `eslint` from the project directory                                                                                             |
| `cache`   | `true`                                           | Automatically cache the task                                                                                                        |
| `inputs`  | `default`                                        | Break the cache if any file in the project changes                                                                                  |
| `inputs`  | `{workspaceRoot}/.eslintrc.json`                 | Break the cache if the root ESLint config file changes. (This will match whatever name you give the root ESLint config file.)       |
| `inputs`  | `{workspaceRoot}/apps/my-project/.eslintrc.json` | Break the cache if the project ESLint config file changes. (This will match whatever name you give the project ESLint config file.) |
| `inputs`  | `{workspaceRoot}/tools/eslint-rules/**/*`        | Break the cache if any custom ESLint rules are changed                                                                              |
| `inputs`  | `{ externalDependencies: [ "eslint" ] }`         | Break the cache if the version of the `eslint` package changes                                                                      |

## Debug Inferred Targets

To view the final output of an inferred target you can use the `nx show project` command or use Nx Console. The result should look something like this:

```json
{
  "targets": {
    "lint": {
      "cache": true,
      "options": { "cwd": "apps/my-project", "command": "eslint ." },
      "inputs": [
        "default",
        "{workspaceRoot}/.eslintrc.json",
        "{workspaceRoot}/apps/my-project/.eslintrc.json",
        "{workspaceRoot}/tools/eslint-rules/**/*",
        { "externalDependencies": ["eslint"] }
      ],
      "executor": "nx:run-commands",
      "configurations": {}
    }
  }
}
```
