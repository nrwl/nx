#### Keep Playwright e2e tasks from waiting for the dev server to be ready

`@nx/playwright/plugin` has a new `waitForServerReady` option, on by default. With it on, the inferred e2e tasks wait for the dev server task's `readyWhen` and get the address it reported in `NX_READY_URL`. Before, they only waited for the dev server task to start.

This migration sets `waitForServerReady: false` on every `@nx/playwright/plugin` entry in `nx.json`, so existing workspaces keep the old behavior. Entries that already set the option stay as they are. To opt in, remove the option or set it to `true`.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "plugins": [
    "@nx/playwright/plugin",
    {
      "plugin": "@nx/playwright/plugin",
      "include": ["apps/admin-e2e/**"],
      "options": { "targetName": "e2e" }
    }
  ]
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/playwright/plugin",
      "options": { "waitForServerReady": false }
    },
    {
      "plugin": "@nx/playwright/plugin",
      "include": ["apps/admin-e2e/**"],
      "options": { "targetName": "e2e", "waitForServerReady": false }
    }
  ]
}
```
