▸ **formatFiles**(`tree`, `options?`): `Promise`\<`void`\>

Formats the created or updated files with the configured formatter,
skipping `node_modules`, `.git`, the nx and yarn caches, and whatever the
workspace's ignore files cover. Which ignore files apply follows the
formatter: prettier reads the workspace root only, oxfmt cascades.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | the file system tree |
| `options?` | `Object` | options for the formatFiles function |
| `options.sortRootTsconfigPaths?` | `boolean` | - |

#### Returns

`Promise`\<`void`\>

**`Remarks`**

`NX_SKIP_FORMAT=true` skips formatting - but not TSConfig path sorting,
which is controlled by `sortRootTsconfigPaths` or
`NX_FORMAT_SORT_TSCONFIG_PATHS`.
