Ƭ **TargetDefaultFilter**: `Object`

The `filter` namespace narrows where a [TargetDefaultArrayEntry](/docs/reference/devkit/TargetDefaultArrayEntry)
applies. An entry with no `filter` is a catch-all baseline that applies to
every variant of its target key; an entry with a `filter` applies only
where the listed criteria all match.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `executor?` | `string` | Restrict the default to targets that resolve to a specific executor (e.g. `@nx/jest:jest`). This narrows *within* a named target key, in addition to the long-standing top-level executor-key form. |
| `plugin?` | `string` | Restrict the default to targets originated by a specific plugin (e.g. `@nx/vite`). Matches against the plugin from nx.json's `plugins` that wrote the target's `executor` or `command`. Targets whose executor/command comes from `project.json` or `package.json` have no source plugin and never match. |
| `projects?` | `string`[] | Restrict the default to a subset of projects. Accepts any patterns supported by `findMatchingProjects` (project names, globs, `tag:foo`, directory globs, negation with `!`). |
