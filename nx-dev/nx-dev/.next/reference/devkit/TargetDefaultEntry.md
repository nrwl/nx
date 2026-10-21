Ƭ **TargetDefaultEntry**: \{ `executor?`: `string` ; `plugin?`: `string` ; `projects?`: `string`[] ; `target?`: `string`  } & `Partial`\<[`TargetConfiguration`](/docs/reference/devkit/TargetConfiguration)\>

A logical, flat view of a single target default — the shape devkit helpers
(`upsertTargetDefault` / `findTargetDefault`) and generators author and read.
It is **not** the on-disk shape: `upsertTargetDefault` translates it into the
map-and-array storage form ([TargetDefaults](/docs/reference/devkit/TargetDefaults)), and `findTargetDefault`
resolves the storage form back to one of these flat entries. Keeping this
flat shape stable is what lets generator call sites read `e.target` /
`e.projects` / `e.plugin` without knowing about `filter`.

Either `target` or `executor` locates the entry; `projects` / `plugin`
narrow it; the remaining `TargetConfiguration` fields are the payload.
