# Function: getOutputsForTargetAndConfiguration

▸ **getOutputsForTargetAndConfiguration**(`task`, `node`): `string`[]

#### Parameters

| Name   | Type                                                                                      |
| :----- | :---------------------------------------------------------------------------------------- |
| `task` | [`Task`](/reference/core-api/devkit/documents/Task)                                       |
| `node` | [`ProjectGraphProjectNode`](/reference/core-api/devkit/documents/ProjectGraphProjectNode) |

#### Returns

`string`[]

**`Deprecated`**

Pass the target and overrides instead. This will be removed in v20.

▸ **getOutputsForTargetAndConfiguration**(`target`, `overrides`, `node`): `string`[]

Returns the list of outputs that will be cached.

#### Parameters

| Name        | Type                                                                                                                              |
| :---------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `target`    | [`Task`](/reference/core-api/devkit/documents/Task) \| \{ `configuration?`: `string` ; `project`: `string` ; `target`: `string` } |
| `overrides` | `any`                                                                                                                             |
| `node`      | [`ProjectGraphProjectNode`](/reference/core-api/devkit/documents/ProjectGraphProjectNode)                                         |

#### Returns

`string`[]
