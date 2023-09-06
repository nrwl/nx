# Function: getOutputsForTargetAndConfiguration

▸ **getOutputsForTargetAndConfiguration**(`task`, `node`): `string`[]

Returns the list of outputs that will be cached.

#### Parameters

| Name   | Type                                                                        | Description                                               |
| :----- | :-------------------------------------------------------------------------- | :-------------------------------------------------------- |
| `task` | `Pick`<[`Task`](../../devkit/documents/Task), `"overrides"` \| `"target"`\> | target + overrides                                        |
| `node` | [`ProjectGraphProjectNode`](../../devkit/documents/ProjectGraphProjectNode) | ProjectGraphProjectNode object that the task runs against |

#### Returns

`string`[]
