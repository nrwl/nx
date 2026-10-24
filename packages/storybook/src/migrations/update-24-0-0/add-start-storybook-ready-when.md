#### Wait for Angular Storybook targets to listen

The `@storybook/angular:start-storybook` builder does not tell Nx when Storybook is listening.
This migration sets a `readyWhen` on these targets that waits until Storybook accepts connections on its port.
Tasks that depend on such a target with `waitFor: 'ready'` then start once Storybook is listening, instead of as soon as the target starts.

The `readyWhen` reads the port and host the way the builder does.
A non-empty `SBCONFIG_PORT` or `SBCONFIG_HOSTNAME` environment variable replaces the `port` or `host` option.
Without them, the builder's defaults apply: port `9009` on `localhost`.

This migration updates every `@storybook/angular:start-storybook` target in your projects.
A target without its own `executor` is updated too when a `targetDefaults` entry in `nx.json` gives it `@storybook/angular:start-storybook`.

The migration leaves the `readyWhen` of a target unchanged in these cases:

- The target already sets `readyWhen`, including `null`.
- The target sets `continuous: false`, or sets no `continuous` and the `targetDefaults` entry that applies to it sets `continuous: false`.
- The `targetDefaults` entry that applies to the target sets `readyWhen`.

Nx checks readiness only for continuous targets.
So the migration also sets `continuous: true` on the targets with their own `@storybook/angular:start-storybook` executor, unless the target or the `targetDefaults` entry that applies to it sets `continuous`.
It skips a target whose options, or any of whose configurations, set `smokeTest: true`.
Storybook exits once it starts in that mode, so the target doesn't run a server.
The setting can come from the target or from the `targetDefaults` entry that applies to it, and the target's own value wins.

#### Sample code changes

##### Before

```json title="libs/ui/project.json"
{
  // ...
  "targets": {
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "continuous": true,
      "options": {
        "port": 4400,
        "configDir": "libs/ui/.storybook",
        "browserTarget": "ui:build-storybook"
      }
    }
  }
}
```

##### After

```json title="libs/ui/project.json" {12-15}
{
  // ...
  "targets": {
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "continuous": true,
      "options": {
        "port": 4400,
        "configDir": "libs/ui/.storybook",
        "browserTarget": "ui:build-storybook"
      },
      "readyWhen": {
        "port": "{env.SBCONFIG_PORT ?? options.port ?? 9009}",
        "host": "{env.SBCONFIG_HOSTNAME ?? options.host ?? localhost}"
      }
    }
  }
}
```
