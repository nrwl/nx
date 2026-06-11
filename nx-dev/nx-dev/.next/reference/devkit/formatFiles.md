▸ **formatFiles**(`tree`, `options?`): `Promise`\<`void`\>

Formats all the created or updated files using Prettier

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | the file system tree |
| `options?` | `Object` | options for the formatFiles function |
| `options.sortRootTsconfigPaths?` | `boolean` | - |

#### Returns

`Promise`\<`void`\>

**`Remarks`**

Set the environment variable `NX_SKIP_FORMAT` to `true` to skip Prettier
formatting. This is useful for repositories that use alternative formatters
like Biome, dprint, or have custom formatting requirements.

Note: `NX_SKIP_FORMAT` only skips Prettier formatting. TSConfig path sorting
(controlled by `sortRootTsconfigPaths` option or `NX_FORMAT_SORT_TSCONFIG_PATHS`)
will still occur.
