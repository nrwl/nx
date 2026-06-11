▸ **getOutputsForTargetAndConfiguration**(`task`, `node`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `task` | [`Task`](/docs/reference/devkit/Task) |
| `node` | [`ProjectGraphProjectNode`](/docs/reference/devkit/ProjectGraphProjectNode) |

#### Returns

`string`[]

**`Deprecated`**

Pass the target and overrides instead. This will be removed in v20.

▸ **getOutputsForTargetAndConfiguration**(`target`, `overrides`, `node`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | [`Task`](/docs/reference/devkit/Task) \| `TaskTarget` |
| `overrides` | `Record`\<`string`, `unknown`\> \| [`ProjectGraphProjectNode`](/docs/reference/devkit/ProjectGraphProjectNode) |
| `node` | [`ProjectGraphProjectNode`](/docs/reference/devkit/ProjectGraphProjectNode) |

#### Returns

`string`[]
