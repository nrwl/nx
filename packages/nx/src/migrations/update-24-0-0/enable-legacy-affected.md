#### Keep legacy `nx affected` selection

In Nx 24, `nx affected -t` selects only the tasks whose inputs a change reaches, instead of every task of each affected project.
This migration sets `affected.legacy` to `true` in `nx.json`, so existing workspaces keep selecting whole projects after upgrading.

To switch to task selection, remove the setting or set it to `false`.
The `NX_LEGACY_AFFECTED` environment variable overrides the setting for a single run: `false` selects tasks and `true` selects projects.

The migration skips workspaces that already set `affected.legacy`.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "defaultBase": "main"
}
```

##### After

```json title="nx.json"
{
  "defaultBase": "main",
  "affected": {
    "legacy": true
  }
}
```
