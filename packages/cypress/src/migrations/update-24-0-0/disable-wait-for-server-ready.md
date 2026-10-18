#### Keep the Cypress e2e tasks from waiting for the dev server to be ready

The `@nx/cypress/plugin` option `waitForServerReady` now defaults to `true`.
With it on, the inferred e2e tasks wait for the dev server task's `readyWhen` check, and `nxE2EPreset` tests against the address the server reported instead of `baseUrl`.

This migration sets `waitForServerReady` to `false` on every `@nx/cypress/plugin` entry in `nx.json`, so existing workspaces keep the old behavior.
It expands a string entry into an object entry, keeps `include`, `exclude`, and other options, and leaves an entry alone when it already sets `waitForServerReady`.
To opt in later, set the option to `true`.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "plugins": ["@nx/cypress/plugin"]
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/cypress/plugin",
      "options": {
        "waitForServerReady": false
      }
    }
  ]
}
```
